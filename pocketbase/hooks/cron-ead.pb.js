// Rede de segurança dos pagamentos. O backend reinicia a cada build (0,3–15 s)
// e um webhook pode simplesmente não chegar. Sem isto: cliente paga e não
// recebe acesso.
//
// MUDANÇA 16/11 (junto com a migração para Orders): o cron passa a cobrir DOIS
// buracos, não um.
//
//   BURACO 1 (já coberto antes): a notificação chegou, a linha em `pagamentos`
//   existe, mas o processamento falhou. → reconferir a linha.
//
//   BURACO 2 (novo, e o mais grave): a notificação NUNCA chegou. Não existe
//   linha nenhuma em `pagamentos` — o cron antigo não tinha o que reconferir e
//   o cliente ficava pagando sem acesso para sempre. → varrer `pedidos`
//   pendentes com mais de 10 min e perguntar ao gateway pelo
//   `external_reference`.
//
// Roda a cada 15 min. Sem MP_ACCESS_TOKEN não roda (e diz isso no log, em vez
// de falhar em silêncio).
//
// Libs INLINE: require local não funciona no JSVM deste projeto.

cronAdd('ead_reconciliacao_pagamentos', '*/15 * * * *', () => {
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
    texto: function (v) {
      return v === undefined || v === null ? '' : String(v).trim()
    },
    agoraIso: function () {
      return new Date().toISOString()
    },
    centavos: function (v) {
      var n = Number(String(v === undefined || v === null ? 0 : v).replace(',', '.'))
      if (isNaN(n)) return 0
      return Math.round(n * 100)
    },
  }

  var app = $app
  var token = comum.segredo('MP_ACCESS_TOKEN')
  if (!token) {
    console.log('[ead][cron] sem MP_ACCESS_TOKEN: reconciliacao nao roda')
    return
  }

  // ---------------------------------------------------------------------
  // BLOCO CENTRAL: dado um pedido e o recurso do gateway, libera ou não.
  // Está numa função só para os dois buracos usarem a MESMA regra — se eu
  // duplicasse, um caminho ficaria diferente do outro e ninguém notaria.
  // ---------------------------------------------------------------------
  function processar(pedido, tipo, status, valorCentavos, idPagamento, bruto) {
    var emailCompra = pedido.getString('email_comprador').toLowerCase()
    var pago = false
    var recusado = false
    var reembolsado = false

    if (tipo === 'order') {
      if (status === 'processed') pago = true
      else if (status === 'refunded') reembolsado = true
      else if (status === 'failed' || status === 'canceled' || status === 'cancelled')
        recusado = true
    } else {
      if (status === 'approved') pago = true
      else if (status === 'refunded' || status === 'charged_back') reembolsado = true
      else if (status === 'rejected' || status === 'cancelled') recusado = true
    }

    if (pago) {
      pedido.set('status', 'pago')
      pedido.set('pagamento_id', idPagamento)
      app.save(pedido)

      var usuario = null
      try {
        usuario = app.findAuthRecordByEmail('users', emailCompra)
      } catch (_) {}
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
        } catch (eUser) {
          console.log('[ead][cron] usuario nao criado: ' + eUser.message)
        }
      }

      if (!usuario) return false

      pedido.set('user', usuario.id)
      app.save(pedido)

      var produto = null
      try {
        produto = app.findRecordById('produtos', pedido.getString('produto'))
      } catch (_) {}
      var cursos = produto ? produto.getStringSlice('cursos') || [] : []
      var liberou = false
      for (var c = 0; c < cursos.length; c++) {
        var tem = null
        try {
          tem = app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
            u: usuario.id,
            c: cursos[c],
          })
        } catch (_) {}
        if (!tem) {
          try {
            // Dispara o e-mail de liberação pelo evento de banco.
            var mcol = app.findCollectionByNameOrId('matriculas')
            var m = new Record(mcol)
            m.set('user', usuario.id)
            m.set('curso', cursos[c])
            m.set('pedido', pedido.id)
            m.set('origem', 'compra')
            m.set('status', 'ativa')
            app.save(m)
            liberou = true
          } catch (eMat) {
            console.log('[ead][cron] matricula falhou: ' + eMat.message)
          }
        }
      }
      return liberou
    }

    if (recusado) {
      pedido.set('status', 'recusado')
      pedido.set('pagamento_id', idPagamento)
      app.save(pedido)
      return true
    }

    if (reembolsado) {
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
      } catch (_) {}
      return true
    }

    return false // ainda em andamento
  }

  var liberados = 0
  var seguem = 0

  // =====================================================================
  // BURACO 1 — linhas de `pagamentos` não processadas.
  // =====================================================================
  var pendentes = []
  try {
    pendentes = app.findRecordsByFilter('pagamentos', 'processado = false', '', 20, 0)
  } catch (err) {
    console.log('[ead][cron] falha ao listar pagamentos: ' + err.message)
  }

  for (var i = 0; i < (pendentes || []).length; i++) {
    var pag = pendentes[i]
    var chave = pag.getString('payment_id')
    // O prefixo diz qual API consultar: 'ord:' = Orders, 'pay:' = Preferências.
    var ehOrder = chave.indexOf('ord:') === 0
    var idRecurso = chave.indexOf(':') !== -1 ? chave.substring(chave.indexOf(':') + 1) : chave
    var tipo1 = ehOrder ? 'order' : 'payment'

    try {
      var url1 =
        tipo1 === 'order'
          ? 'https://api.mercadopago.com/v1/orders/' + encodeURIComponent(idRecurso)
          : 'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(idRecurso)

      var resp1 = $http.send({
        url: url1,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        timeout: 25,
      })
      if (!resp1 || resp1.statusCode < 200 || resp1.statusCode >= 300) {
        seguem++
        continue
      }

      var recurso1 = JSON.parse(toString(resp1.body))
      var status1 = comum.texto(recurso1.status)
      pag.set('status', status1)
      var valor1 =
        tipo1 === 'order'
          ? comum.centavos(recurso1.total_paid_amount || recurso1.total_amount || 0)
          : comum.centavos(recurso1.transaction_amount || 0)
      if (valor1 > 0) pag.set('valor_centavos', valor1)
      try {
        pag.set('payload_bruto', recurso1)
      } catch (_) {}

      var pedido1 = null
      var ref1 = comum.texto(recurso1.external_reference)
      if (ref1) {
        try {
          pedido1 = app.findRecordById('pedidos', ref1)
        } catch (_) {}
      }
      if (!pedido1) {
        var email1 = comum.texto(recurso1.payer && recurso1.payer.email).toLowerCase()
        if (email1) {
          try {
            pedido1 = app.findFirstRecordByFilter(
              'pedidos',
              "email_comprador = {:e} && status = 'pendente'",
              { e: email1 },
            )
          } catch (_) {}
        }
      }
      if (!pedido1) {
        seguem++
        app.save(pag)
        continue
      }

      var idPag1 = idRecurso
      if (tipo1 === 'order') {
        try {
          var trs1 = recurso1.transactions && recurso1.transactions.payments
          if (trs1 && trs1.length && trs1[0].id) idPag1 = String(trs1[0].id)
        } catch (_) {}
      }

      var feito1 = processar(pedido1, tipo1, status1, valor1, idPag1, recurso1)
      if (feito1) {
        pag.set('processado', true)
        if (status1 === 'processed' || status1 === 'approved') liberados++
      } else if (
        status1 === 'created' ||
        status1 === 'processing' ||
        status1 === 'action_required' ||
        status1 === 'pending' ||
        status1 === 'in_process'
      ) {
        seguem++
      } else {
        pag.set('processado', true)
      }
      app.save(pag)
    } catch (err2) {
      seguem++
      console.log('[ead][cron] erro em ' + chave + ': ' + err2.message)
    }
  }

  // =====================================================================
  // BURACO 2 — pedidos pendentes cujo webhook nunca chegou.
  // Só olha pedidos com mais de 10 min: abaixo disso o webhook ainda pode
  // estar a caminho e a consulta seria desperdício.
  // =====================================================================
  var corte = new Date(Date.now() - 10 * 60000).toISOString()
  var orfaos = []
  try {
    orfaos = app.findRecordsByFilter(
      'pedidos',
      "status = 'pendente' && criado_em < {:c}",
      'criado_em',
      15,
      0,
      { c: corte },
    )
  } catch (err3) {
    console.log('[ead][cron] falha ao listar pedidos pendentes: ' + err3.message)
  }

  for (var j = 0; j < (orfaos || []).length; j++) {
    var ped = orfaos[j]
    try {
      // 1) Orders primeiro (fluxo atual do checkout).
      // ATENÇÃO: GET /v1/orders EXIGE begin_date e end_date (RFC3339). Sem as
      // datas devolve 400 required_search_params — a busca nunca acharia nada
      // e o pedido ficaria pendente para sempre. Janela de 30 dias para trás,
      // que cobre boleto/pix em atraso e é o máximo aceito pelo MP em alguns
      // países.
      var achou = false
      var agoraD = new Date()
      var inicioD = new Date(agoraD.getTime() - 30 * 24 * 3600 * 1000)
      var rBusca = $http.send({
        url:
          'https://api.mercadopago.com/v1/orders?begin_date=' +
          encodeURIComponent(inicioD.toISOString()) +
          '&end_date=' +
          encodeURIComponent(agoraD.toISOString()) +
          '&external_reference=' +
          encodeURIComponent(ped.id) +
          '&type=online',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        timeout: 25,
      })

      if (rBusca && rBusca.statusCode >= 200 && rBusca.statusCode < 300) {
        var dBusca = {}
        try {
          dBusca = JSON.parse(toString(rBusca.body))
        } catch (_) {}
        // A resposta de /v1/orders vem em `data`; a de /v1/payments em `results`.
        var resultados = dBusca.data || dBusca.results || []
        if (resultados && resultados.length) {
          var ord = resultados[0]
          var stOrd = comum.texto(ord.status)
          var idPagOrd = comum.texto(ord.id)
          try {
            var trsO = ord.transactions && ord.transactions.payments
            if (trsO && trsO.length && trsO[0].id) idPagOrd = String(trsO[0].id)
          } catch (_) {}
          var feitoO = processar(
            ped,
            'order',
            stOrd,
            comum.centavos(ord.total_paid_amount || ord.total_amount || 0),
            idPagOrd,
            ord,
          )
          if (feitoO) {
            liberados++
            achou = true
          }
        }
      }

      // 2) Se não achou em Orders, tenta em Payments (pedidos do caminho antigo).
      if (!achou) {
        var rPag = $http.send({
          url:
            'https://api.mercadopago.com/v1/payments/search?external_reference=' +
            encodeURIComponent(ped.id),
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 25,
        })
        if (rPag && rPag.statusCode >= 200 && rPag.statusCode < 300) {
          var dPag = {}
          try {
            dPag = JSON.parse(toString(rPag.body))
          } catch (_) {}
          var resPag = dPag.results || []
          if (resPag && resPag.length) {
            var pg = resPag[0]
            var feitoP = processar(
              ped,
              'payment',
              comum.texto(pg.status),
              comum.centavos(pg.transaction_amount || 0),
              comum.texto(pg.id),
              pg,
            )
            if (feitoP) liberados++
          }
        }
      }
    } catch (err4) {
      console.log('[ead][cron] erro ao reconciliar pedido ' + ped.id + ': ' + err4.message)
    }
  }

  if (liberados || seguem) {
    console.log(
      '[ead][cron] reconciliacao: ' +
        liberados +
        ' liberados, ' +
        seguem +
        ' aguardando, ' +
        (orfaos ? orfaos.length : 0) +
        ' pedidos sem webhook conferidos',
    )
  }
})

// Retenção do log de acesso: 12 meses (LGPD).
cronAdd('ead_retencao_log', '0 4 * * *', () => {
  var app = $app
  var limite = new Date()
  limite.setFullYear(limite.getFullYear() - 1)
  var corte = limite.toISOString()
  var velhos = []
  try {
    velhos = app.findRecordsByFilter('log_acessos', 'em < {:c}', '', 500, 0, { c: corte })
  } catch (e) {
    console.log('[ead][cron] falha ao listar log antigo: ' + e.message)
    return
  }
  for (var i = 0; i < (velhos || []).length; i++) {
    try {
      app.delete(velhos[i])
    } catch (e2) {}
  }
  if (velhos && velhos.length)
    console.log('[ead][cron] retencao: ' + velhos.length + ' registros removidos')
})
