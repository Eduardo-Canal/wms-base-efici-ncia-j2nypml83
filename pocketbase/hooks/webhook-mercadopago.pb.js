// POST /backend/v1/webhooks/mercadopago — libera acesso quando o pagamento cai.
// Ordem: lê o corpo → valida HMAC ANTES de gravar → grava em pagamentos com
// payment_id único (idempotência) → se já processado, responde 200 e sai →
// processa (consulta o gateway e libera). Libs inlinadas: require local não
// funciona no Skip. Segredo sempre por $secrets.get.
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
      return String($security.hs256(String(dados), String(chave)))
    },
    // Comparacao em tempo constante feita a mao. NAO usar $security.equal:
    // ele lancou excecao neste runtime e o try/catch devolvia false sempre —
    // resultado: assinatura valida era recusada como invalida (testado).
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
  if (tipo && tipo !== 'payment') return e.json(200, { recebido: true, ignorado: 'tipo_' + tipo })

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

  var requestId = comum.texto(e.request.header.get('x-request-id'))
  var canonica = 'id:' + dataId + ';'
  if (requestId) canonica += 'request-id:' + requestId + ';'
  canonica += 'ts:' + ts + ';'

  if (!comum.iguais(comum.hmachex(canonica, segredo), v1)) {
    console.log('[ead] webhook com assinatura invalida (data.id=' + dataId + ')')
    return e.json(401, { codigo: 'assinatura_invalida', mensagem: 'Assinatura inválida.' })
  }

  // ---- idempotência ----
  var existente = null
  try {
    existente = app.findFirstRecordByFilter('pagamentos', 'payment_id = {:p}', { p: dataId })
  } catch (err) {}
  if (existente && existente.getBool('processado')) {
    return e.json(200, { recebido: true, duplicado: true })
  }
  if (!existente) {
    try {
      var col = app.findCollectionByNameOrId('pagamentos')
      var p = new Record(col)
      p.set('gateway', 'mercadopago')
      p.set('payment_id', dataId)
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

    var resp = $http.send({
      url: 'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(dataId),
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      timeout: 25,
    })
    if (!resp || resp.statusCode < 200 || resp.statusCode >= 300) {
      return e.json(200, { recebido: true, aguardando: 'gateway' })
    }

    var pg = JSON.parse(toString(resp.body))
    var status = String(pg.status || '')
    existente.set('status', status)
    var valor = Math.round(Number(pg.transaction_amount || 0) * 100)
    if (valor > 0) existente.set('valor_centavos', valor)
    try {
      existente.set('payload_bruto', pg)
    } catch (x4) {}

    var pedido = null
    var pedidoId = comum.texto(pg.external_reference)
    if (pedidoId) {
      try {
        pedido = app.findRecordById('pedidos', pedidoId)
      } catch (x5) {}
    }
    if (!pedido) {
      var email = comum.texto(pg.payer && pg.payer.email).toLowerCase()
      if (email) {
        try {
          pedido = app.findFirstRecordByFilter(
            'pedidos',
            "email_comprador = {:e} && status = 'pendente'",
            { e: email },
          )
        } catch (x6) {}
      }
    }

    if (!pedido) {
      existente.set('processado', false)
      app.save(existente)
      return e.json(200, { recebido: true, aguardando: 'pedido' })
    }
    existente.set('pedido', pedido.id)

    if (status === 'approved') {
      pedido.set('status', 'pago')
      pedido.set('pagamento_id', dataId)
      app.save(pedido)

      var usuario = null
      var emailCompra = pedido.getString('email_comprador').toLowerCase()
      try {
        usuario = app.findAuthRecordByEmail('users', emailCompra)
      } catch (x7) {}
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
    } else if (status === 'rejected' || status === 'cancelled') {
      pedido.set('status', 'recusado')
      pedido.set('pagamento_id', dataId)
      app.save(pedido)
    } else if (status === 'refunded' || status === 'charged_back') {
      pedido.set('status', 'reembolsado')
      pedido.set('pagamento_id', dataId)
      app.save(pedido)
      try {
        var ms = app.findRecordsByFilter('matriculas', 'pedido = {:p}', '', 50, 0, { p: pedido.id })
        for (var k = 0; k < ms.length; k++) {
          ms[k].set('status', 'reembolsada')
          app.save(ms[k])
        }
      } catch (x12) {}
    } else {
      existente.set('processado', false)
      app.save(existente)
      return e.json(200, { recebido: true, aguardando: status })
    }

    existente.set('processado', true)
    app.save(existente)
    return e.json(200, { recebido: true, status: status })
  } catch (err3) {
    console.log('[ead] erro ao processar pagamento: ' + err3.message)
    return e.json(200, { recebido: true, aguardando: 'erro' })
  }
})
