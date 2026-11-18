// POST /backend/v1/webhooks/mercadopago — libera o acesso quando o pagamento cai.
//
// MUDANÇA 16/11 (migração para a Orders API): o Mercado Pago agora notifica
// dois formatos, e este endpoint aceita os dois:
//
//   type = "payment"  → API de Preferências (fluxo antigo)
//                        dado: PAY...  → GET /v1/payments/{id}
//                        pago quando status = "approved"
//
//   type = "order"    → Orders API (fluxo novo)
//                        dado: ORD...  → GET /v1/orders/{id}
//                        pago quando status = "processed"
//
// POR QUE NÃO SÓ ORDERS: pedidos criados antes da migração, e o fallback do
// checkout, ainda geram notificação de `payment`. Se o webhook só entendesse
// Orders, uma venda no caminho antigo ficaria sem liberação — o cliente paga e
// não recebe acesso. Aceitar os dois é o que mantém a promessa.
//
// ORDEM DAS OPERAÇÕES (não mudar sem motivo):
//   1. lê o corpo → 2. valida HMAC ANTES de gravar → 3. grava em `pagamentos`
//   com id único (idempotência) → 4. se já processado, responde 200 e sai →
//   5. consulta o gateway e libera.
//
// Libs INLINE: require local não funciona no JSVM deste projeto.

routerAdd('POST', '/backend/v1/webhooks/mercadopago', (e) => {
  const comum = {
    segredo: function (nome) {
      try {
        if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
          var v = $secrets.get(nome, '')
          if (v) return String(v)
        }
      } catch (e1) {}
      try {
        var e2 = $os.getenv(nome)
        return e2 ? String(e2) : ''
      } catch (e3) {
        return ''
      }
    },
    hmachex: function (dados, chave) {
      // ORDEM IMPORTA: hs256(dados, chave). Invertida, nunca valida — e a
      // assinatura válida era recusada em silêncio.
      return String($security.hs256(String(dados), String(chave)))
    },
    // Comparação em tempo constante, feita à mão: $security.equal lançou
    // exceção neste runtime e o try/catch devolvia false sempre (testado).
    iguais: function (a, b) {
      var x = String(a)
      var y = String(b)
      if (x.length !== y.length) return false
      var dif = 0
      for (var i = 0; i < x.length; i++) {
        dif = dif | (x.charCodeAt(i) ^ y.charCodeAt(i))
      }
      return dif === 0
    },
    texto: function (v) {
      return v === undefined || v === null ? '' : String(v).trim()
    },
    agoraIso: function () {
      return new Date().toISOString()
    },
    // Orders devolve valor em string ("197.00"); Preferences em número.
    centavos: function (v) {
      var n = Number(String(v === undefined || v === null ? 0 : v).replace(',', '.'))
      if (isNaN(n)) return 0
      return Math.round(n * 100)
    },
  }

  var app = $app
  var corpo = {}
  try {
    corpo = e.requestInfo().body || {}
  } catch (x) {}

  var tipo = comum.texto(corpo.type || corpo.topic)
  var dataId = ''
  try {
    dataId = comum.texto(corpo.data && corpo.data.id)
  } catch (x2) {}
  if (!dataId) {
    try {
      dataId = comum.texto(e.request.url.query().get('data.id') || e.request.url.query().get('id'))
    } catch (x3) {}
  }

  if (!dataId) return e.json(200, { recebido: true, ignorado: 'sem_data_id' })

  // Aceita 'payment' (Preferences) e 'order'/'orders' (Orders). O MP usa os
  // dois nomes para orders: o corpo traz type="order" e a tabela de tópicos do
  // painel chama o evento de "orders". Aceitar só um dos dois faria a
  // notificação do fluxo novo cair no "ignorado" — cliente paga e nada acontece.
  // Qualquer outro tópico (merchant_order, subscription...) é reconhecido com
  // 200 e ignorado: sem isso o MP reenvia por 15 min à toa.
  var tipoOrder = tipo === 'order' || tipo === 'orders'
  if (tipo && tipo !== 'payment' && !tipoOrder) {
    return e.json(200, { recebido: true, ignorado: 'tipo_' + tipo })
  }

  // ---- assinatura: validada ANTES de qualquer gravação ----
  var segredo = comum.segredo('MP_WEBHOOK_SECRET')
  if (!segredo) {
    console.log('[ead] webhook sem MP_WEBHOOK_SECRET configurado')
    return e.json(503, { codigo: 'config_ausente', mensagem: 'Webhook não configurado.' })
  }

  var header = comum.texto(e.request.header.get('x-signature'))
  var ts = ''
  var v1 = ''
  var partes = header.split(',')
  for (var i = 0; i < partes.length; i++) {
    var kv = partes[i].split('=')
    if (kv.length < 2) continue
    var k = comum.texto(kv[0])
    var v = comum.texto(kv.slice(1).join('='))
    if (k === 'ts') ts = v
    if (k === 'v1') v1 = v
  }
  if (!ts || !v1)
    return e.json(401, { codigo: 'assinatura_ausente', mensagem: 'Assinatura ausente.' })

  // A string canônica inclui o x-request-id QUANDO ele existe. Medido em 15/11:
  // o proxy da plataforma injeta o próprio x-request-id, que não é o que o MP
  // assinou. Solução: aceitar as duas formas. Não afrouxa a segurança —
  // continua exigindo HMAC válido sobre um dos dois textos canônicos.
  var requestId = comum.texto(e.request.header.get('x-request-id'))
  var canonicaSem = 'id:' + dataId + ';ts:' + ts + ';'
  var canonicaCom = 'id:' + dataId + ';'
  if (requestId) canonicaCom += 'request-id:' + requestId + ';'
  canonicaCom += 'ts:' + ts + ';'

  var okAssinatura =
    comum.iguais(comum.hmachex(canonicaSem, segredo), v1) ||
    comum.iguais(comum.hmachex(canonicaCom, segredo), v1)
  if (!okAssinatura) {
    console.log('[ead] webhook com assinatura invalida (data.id=' + dataId + ')')
    return e.json(401, { codigo: 'assinatura_invalida', mensagem: 'Assinatura inválida.' })
  }

  // ---- idempotência ----
  // payment_id guarda o id do recurso notificado (PAY... ou ORD...). O sufixo
  // de tipo evita colisão teórica entre um PAY e um ORD de mesmo valor textual.
  var chaveRecurso = (tipoOrder ? 'ord:' : 'pay:') + dataId

  var existente = null
  try {
    existente = app.findFirstRecordByFilter('pagamentos', 'payment_id = {:p}', { p: chaveRecurso })
  } catch (err) {}
  // REVISÃO EXTERNA (item 4): antes esta linha respondia "duplicado" para
  // QUALQUER notificação já processada. Como o reembolso chega com o MESMO id
  // de pagamento, ele era descartado aqui e o trecho abaixo (que revoga o
  // acesso em refunded/charged_back) nunca rodava — o aluno era reembolsado e
  // continuava com o curso. Agora NÃO sai por aqui: segue para consultar o
  // gateway e compara o status novo com o gravado. Só encerra como duplicado
  // depois de conferir que o status é o mesmo.
  if (!existente) {
    try {
      var col = app.findCollectionByNameOrId('pagamentos')
      var p = new Record(col)
      p.set('gateway', tipoOrder ? 'mercadopago-orders' : 'mercadopago')
      p.set('payment_id', chaveRecurso)
      p.set('status', 'recebido')
      p.set('valor_centavos', 0)
      p.set('recebido_em', comum.agoraIso())
      p.set('processado', false)
      app.save(p)
      existente = p
    } catch (err2) {
      console.log('[ead] falha ao gravar pagamento: ' + err2.message)
      return e.json(500, { codigo: 'gravacao_falhou', mensagem: 'Não foi possível registrar.' })
    }
  }

  try {
    var token = comum.segredo('MP_ACCESS_TOKEN')
    if (!token) return e.json(200, { recebido: true, aguardando: 'token_ausente' })

    // ---- consulta o recurso no gateway (nunca confia só no corpo) ----
    var url = tipoOrder
      ? 'https://api.mercadopago.com/v1/orders/' + encodeURIComponent(dataId)
      : 'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(dataId)

    var resp = $http.send({
      url: url,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      timeout: 25,
    })
    if (!resp || resp.statusCode < 200 || resp.statusCode >= 300) {
      return e.json(200, { recebido: true, aguardando: 'gateway' })
    }

    var recurso = JSON.parse(toString(resp.body))
    var statusGw = comum.texto(recurso.status)

    // ---- idempotência REAL (item 4) ----
    // Só encerra quando o status consultado no gateway é o mesmo já gravado:
    // repetição da mesma notificação não duplica nada, e mudança de status
    // (approved → refunded) segue adiante e revoga o acesso.
    if (existente.getBool('processado') && existente.getString('status') === statusGw) {
      return e.json(200, { recebido: true, duplicado: true, status: statusGw })
    }

    // Traduz os dois vocabulários para um só, porque o resto do sistema
    // (pedido, matrícula, painel) só conhece: pago / recusado / reembolsado.
    var pago = false
    var recusado = false
    var reembolsado = false

    if (tipoOrder) {
      // Orders: processed = pagamento efetivado. `status_detail` diz se foi
      // integral (accredited) ou parcial (partially_refunded).
      if (statusGw === 'processed') pago = true
      else if (statusGw === 'refunded') reembolsado = true
      else if (statusGw === 'failed' || statusGw === 'canceled' || statusGw === 'cancelled')
        recusado = true
      // 'created', 'processing', 'action_required' → aguardando, cai no else.
    } else {
      if (statusGw === 'approved') pago = true
      else if (statusGw === 'refunded' || statusGw === 'charged_back') reembolsado = true
      else if (statusGw === 'rejected' || statusGw === 'cancelled') recusado = true
    }

    existente.set('status', statusGw)

    var valor = 0
    if (tipoOrder) {
      valor = comum.centavos(recurso.total_paid_amount || recurso.total_amount || 0)
    } else {
      valor = comum.centavos(recurso.transaction_amount || 0)
    }
    if (valor > 0) existente.set('valor_centavos', valor)

    try {
      existente.set('payload_bruto', recurso)
    } catch (x4) {}

    // ---- acha o pedido: external_reference é o caminho normal ----
    var pedido = null
    var pedidoId = comum.texto(recurso.external_reference)
    if (pedidoId) {
      try {
        pedido = app.findRecordById('pedidos', pedidoId)
      } catch (x5) {}
    }
    // Plano B: e-mail do pagador. Em Orders o pagador está em `payer.email`.
    //
    // REVISÃO EXTERNA (item 5): antes, QUALQUER pagamento aprovado com o mesmo
    // e-mail casava com QUALQUER pedido pendente daquele e-mail. Isso permite
    // duas coisas ruins: (a) pagar R$ 1 e liberar um pedido de R$ 197;
    // (b) um pagamento antigo liberar um pedido novo. Agora o plano B só vale
    // quando o valor pago é IGUAL ao do pedido e o pagamento é posterior ao
    // pedido. Fora disso, o pagamento fica para conferência manual no painel.
    var suspeitaManual = ''
    if (!pedido) {
      var email = comum.texto(recurso.payer && recurso.payer.email).toLowerCase()
      if (email) {
        var candidatos = []
        try {
          candidatos = app.findRecordsByFilter(
            'pedidos',
            "email_comprador = {:e} && status = 'pendente'",
            '-created',
            20,
            0,
            { e: email },
          )
        } catch (x6) {}
        // Data do pagamento no gateway (quando existir).
        var pagoEm = 0
        try {
          var dtStr = comum.texto(recurso.date_approved || recurso.date_created)
          if (dtStr) {
            var t = new Date(dtStr.replace(' ', 'T')).getTime()
            if (!isNaN(t)) pagoEm = t
          }
        } catch (_dt) {}
        for (var ci = 0; ci < candidatos.length; ci++) {
          var cand = candidatos[ci]
          var valorPedido = cand.getInt('valor_centavos')
          // Valor igual é obrigatório. Sem valor no pedido, não casa.
          if (!valorPedido || valorPedido !== valor) continue
          // Pagamento tem que ser posterior ao pedido (tolerância de 5 min
          // para relógio do gateway).
          if (pagoEm > 0) {
            var criadoEm = 0
            try {
              var cs = comum.texto(cand.getString('criado_em') || cand.getString('created'))
              if (cs) {
                var tc = new Date(cs.replace(' ', 'T')).getTime()
                if (!isNaN(tc)) criadoEm = tc
              }
            } catch (_c2) {}
            if (criadoEm > 0 && pagoEm < criadoEm - 5 * 60 * 1000) continue
          }
          pedido = cand
          break
        }
        if (!pedido && candidatos.length) {
          // Existe pedido desse e-mail, mas nada bate em valor/data: não
          // libera automático. Fica marcado para o dono conferir.
          suspeitaManual = 'valor_ou_data_divergente'
        } else if (!pedido && !candidatos.length) {
          suspeitaManual = 'sem_pedido_para_o_email'
        }
      }
    }

    if (!pedido) {
      existente.set('processado', false)
      // Marca para conferência manual quando o pagamento existe mas não casa
      // com pedido nenhum (item 5). O painel lista isso.
      if (suspeitaManual) {
        try {
          existente.set('observacao', suspeitaManual)
        } catch (_obs) {}
      }
      app.save(existente)
      return e.json(200, {
        recebido: true,
        aguardando: 'pedido',
        conferencia_manual: suspeitaManual || undefined,
      })
    }
    existente.set('pedido', pedido.id)

    // Id do pagamento para o painel/recibo: em Orders fica dentro de transactions.
    var idPagamento = dataId
    if (tipoOrder) {
      try {
        var trs = recurso.transactions && recurso.transactions.payments
        if (trs && trs.length && trs[0].id) idPagamento = String(trs[0].id)
      } catch (_) {}
    }

    if (pago) {
      pedido.set('status', 'pago')
      pedido.set('pagamento_id', idPagamento)
      app.save(pedido)

      var usuario = null
      var emailCompra = pedido.getString('email_comprador').toLowerCase()
      try {
        usuario = app.findAuthRecordByEmail('users', emailCompra)
      } catch (x7) {}

      // ---- 6. conta existente com e-mail NÃO verificado ----
      // REVISÃO EXTERNA (item 6): um terceiro podia pré-cadastrar o e-mail de
      // outra pessoa e, quando ela comprasse, ficar com o curso. O comprador
      // legítimo nunca recebia o curso, e o invasor sim.
      // Correção: se a conta existir sem verificação, a senha é trocada por uma
      // aleatória (derruba as sessões ativas do invasor), o e-mail volta a não
      // verificado e a pessoa recebe o fluxo de definir senha.
      if (usuario && !usuario.getBool('verified')) {
        try {
          usuario.set('password', $security.randomString(40))
          usuario.set('passwordConfirm', usuario.getString('password'))
          usuario.set('verified', false)
          app.save(usuario)
          console.log('[ead] conta nao verificada: senha rotacionada para ' + emailCompra)
        } catch (xRot) {
          console.log('[ead] falha ao rotacionar senha: ' + xRot.message)
        }
        // Envia o e-mail de definir senha pelo endpoint nativo. É o mesmo
        // caminho que a tela "esqueci minha senha" usa — sem inventar token.
        try {
          var baseUrl = ''
          try {
            baseUrl = String(comum.segredo('PB_INSTANCE_URL') || '')
          } catch (_b) {}
          if (!baseUrl) baseUrl = 'http://127.0.0.1:8090'
          if (baseUrl.charAt(baseUrl.length - 1) === '/')
            baseUrl = baseUrl.substring(0, baseUrl.length - 1)
          $http.send({
            url: baseUrl + '/api/collections/users/request-password-reset',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailCompra }),
            timeout: 10,
          })
        } catch (xMail) {
          console.log('[ead] envio de definir senha falhou: ' + xMail.message)
        }
      }

      if (!usuario && emailCompra) {
        try {
          var usersCol = app.findCollectionByNameOrId('users')
          var u = new Record(usersCol)
          u.set('email', emailCompra)
          u.set('name', pedido.getString('nome_comprador'))
          u.set('papel', 'aluno')
          u.set('emailVisibility', false)
          u.set('password', $security.randomString(32))
          u.set('passwordConfirm', u.getString('password'))
          app.save(u)
          usuario = u
        } catch (x8) {
          console.log('[ead] usuario nao criado: ' + x8.message)
        }
      }

      if (usuario) {
        pedido.set('user', usuario.id)
        app.save(pedido)

        var produto = null
        try {
          produto = app.findRecordById('produtos', pedido.getString('produto'))
        } catch (x9) {}
        var cursos = produto ? produto.getStringSlice('cursos') || [] : []
        for (var c = 0; c < cursos.length; c++) {
          var tem = null
          try {
            tem = app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
              u: usuario.id,
              c: cursos[c],
            })
          } catch (x10) {}
          if (!tem) {
            try {
              // A matrícula criada aqui dispara o e-mail de liberação
              // (hooks/acesso-email.pb.js, evento de banco) — por isso o
              // aviso sai por qualquer caminho, não só por este.
              var mcol = app.findCollectionByNameOrId('matriculas')
              var m = new Record(mcol)
              m.set('user', usuario.id)
              m.set('curso', cursos[c])
              m.set('pedido', pedido.id)
              m.set('origem', 'compra')
              m.set('status', 'ativa')
              app.save(m)
            } catch (x11) {
              console.log('[ead] matricula falhou: ' + x11.message)
            }
          }
        }
      }
    } else if (recusado) {
      pedido.set('status', 'recusado')
      pedido.set('pagamento_id', idPagamento)
      app.save(pedido)
    } else if (reembolsado) {
      pedido.set('status', 'reembolsado')
      pedido.set('pagamento_id', idPagamento)
      app.save(pedido)
      try {
        var ms = app.findRecordsByFilter('matriculas', 'pedido = {:p}', '', 50, 0, {
          p: pedido.id,
        })
        for (var k = 0; k < ms.length; k++) {
          ms[k].set('status', 'reembolsada')
          app.save(ms[k])
        }
      } catch (x12) {}
    } else {
      // created / processing / action_required: ainda vai acontecer.
      existente.set('processado', false)
      app.save(existente)
      return e.json(200, { recebido: true, aguardando: statusGw })
    }

    existente.set('processado', true)
    app.save(existente)
    return e.json(200, { recebido: true, api: tipo, status: statusGw })
  } catch (err3) {
    console.log('[ead] erro ao processar pagamento: ' + err3.message)
    return e.json(200, { recebido: true, aguardando: 'erro' })
  }
})
