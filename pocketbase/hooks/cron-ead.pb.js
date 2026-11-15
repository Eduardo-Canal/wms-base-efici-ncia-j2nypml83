// Rede de segurança dos pagamentos. O backend reinicia a cada build (0,3–15 s)
// e um webhook pode não chegar. Sem isto, cliente pagou e não recebeu acesso.
// Roda a cada 15 min: toda linha de `pagamentos` não processada com mais de
// 5 min é reconferida no gateway e, se aprovada, libera o curso.
// Libs inlinadas: require local não funciona no Skip.
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
  }

  var app = $app
  var token = comum.segredo('MP_ACCESS_TOKEN')
  if (!token) {
    console.log('[ead][cron] sem MP_ACCESS_TOKEN: reconciliacao nao roda')
    return
  }

  var pendentes = []
  try {
    pendentes = app.findRecordsByFilter('pagamentos', 'processado = false', '', 20, 0)
  } catch (err) {
    console.log('[ead][cron] falha ao listar pagamentos: ' + err.message)
    return
  }
  if (!pendentes || !pendentes.length) return

  var liberados = 0
  var seguem = 0

  for (var i = 0; i < pendentes.length; i++) {
    var pag = pendentes[i]
    var paymentId = pag.getString('payment_id')
    try {
      var resp = $http.send({
        url: 'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        timeout: 25,
      })
      if (!resp || resp.statusCode < 200 || resp.statusCode >= 300) {
        seguem++
        continue
      }

      var pg = JSON.parse(toString(resp.body))
      var status = String(pg.status || '')
      pag.set('status', status)
      var valor = Math.round(Number(pg.transaction_amount || 0) * 100)
      if (valor > 0) pag.set('valor_centavos', valor)
      try {
        pag.set('payload_bruto', pg)
      } catch (x) {}

      // Pedido: external_reference é o caminho normal; e-mail é o plano B.
      var pedido = null
      var ref = comum.texto(pg.external_reference)
      if (ref) {
        try {
          pedido = app.findRecordById('pedidos', ref)
        } catch (x2) {}
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
          } catch (x3) {}
        }
      }
      if (!pedido) {
        seguem++
        app.save(pag)
        continue
      }
      pag.set('pedido', pedido.id)

      if (status === 'approved') {
        pedido.set('status', 'pago')
        pedido.set('pagamento_id', paymentId)
        app.save(pedido)

        var usuario = null
        var emailCompra = pedido.getString('email_comprador').toLowerCase()
        try {
          usuario = app.findAuthRecordByEmail('users', emailCompra)
        } catch (x4) {}
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
          } catch (x5) {
            console.log('[ead][cron] usuario nao criado: ' + x5.message)
          }
        }

        if (usuario) {
          pedido.set('user', usuario.id)
          app.save(pedido)
          var produto = null
          try {
            produto = app.findRecordById('produtos', pedido.getString('produto'))
          } catch (x6) {}
          var cursos = produto ? produto.getStringSlice('cursos') || [] : []
          for (var c = 0; c < cursos.length; c++) {
            var tem = null
            try {
              tem = app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
                u: usuario.id,
                c: cursos[c],
              })
            } catch (x7) {}
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
                liberados++
              } catch (x8) {
                console.log('[ead][cron] matricula falhou: ' + x8.message)
              }
            }
          }
        }
        pag.set('processado', true)
      } else if (status === 'rejected' || status === 'cancelled') {
        pedido.set('status', 'recusado')
        pedido.set('pagamento_id', paymentId)
        app.save(pedido)
        pag.set('processado', true)
      } else if (status === 'refunded' || status === 'charged_back') {
        pedido.set('status', 'reembolsado')
        pedido.set('pagamento_id', paymentId)
        app.save(pedido)
        try {
          var ms = app.findRecordsByFilter('matriculas', 'pedido = {:p}', '', 50, 0, {
            p: pedido.id,
          })
          for (var k = 0; k < ms.length; k++) {
            ms[k].set('status', 'reembolsada')
            app.save(ms[k])
          }
        } catch (x9) {}
        pag.set('processado', true)
      } else {
        seguem++
      }
      app.save(pag)
    } catch (err2) {
      seguem++
      console.log('[ead][cron] erro em ' + paymentId + ': ' + err2.message)
    }
  }
  console.log('[ead][cron] reconciliacao: ' + liberados + ' liberados, ' + seguem + ' aguardando')
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
