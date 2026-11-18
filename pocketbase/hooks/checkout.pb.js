// POST /backend/v1/checkout — cria a cobrança no Mercado Pago.
//
// MUDANÇA 16/11 (pedido do dono): migração para a **Orders API**, porque o
// painel do Mercado Pago avisa que a API de Preferências "será descontinuada
// em breve". Orders é o caminho suportado daqui para frente.
//
// ORDERS E PREFERENCES CONVIVEM — e o código usa isso a favor:
//   1. Tenta Orders (POST /v1/orders) → devolve `checkout_url`.
//   2. Se o gateway recusar (conta sem Orders habilitado, 400/404), cai para
//      Preferences (POST /checkout/preferences) → devolve `init_point`.
//   3. Registra em `pedidos.gateway` qual caminho foi usado
//      ('mercadopago-orders' ou 'mercadopago'), porque o webhook e o cron
//      precisam saber onde consultar depois.
//
// POR QUE A QUEDA AUTOMÁTICA: sem ela, um detalhe de habilitação na conta
// (fora do meu alcance) derrubaria a venda inteira. Com ela, a venda acontece
// e o pior caso é continuar no fluxo antigo — visível no log, não invisível.
//
// O QUE NÃO MUDA (e é o que protege o dono):
//   * O VALOR VEM DO BANCO. Preço no corpo é ignorado — senão qualquer um
//     compraria por R$ 1 editando o request.
//   * Produto inativo ou sem preço recusa.
//   * Quem já tem matrícula recebe 409 em vez de pagar duas vezes.
//   * `external_reference` = id do pedido: é como o webhook casa o pagamento
//     sem adivinhar por e-mail.
//
// Libs INLINE: require local não funciona no JSVM deste projeto.

routerAdd('POST', '/backend/v1/checkout', (e) => {
  // ---- PORTÃO (revisão externa, item 12) ----
  // Área fechada: compra não acontece — o catálogo também está oculto, então
  // aceitar checkout seria vender um curso que ninguém vê. Equipe passa para
  // testar; e quem já tem matrícula ativa passa (caso de renovação/segundo curso).
  var areaAbertaPg = false
  try {
    var cfgPg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    areaAbertaPg = cfgPg.getBool('liberado') === true
  } catch (_pg) {
    areaAbertaPg = false
  }
  if (!areaAbertaPg) {
    var authPg = null
    try {
      authPg = e.requestInfo().auth
    } catch (_pg2) {}
    var liberadoPg = false
    try {
      if (authPg) {
        if (authPg.collection().name === '_superusers') liberadoPg = true
        else {
          var papelPg = String(authPg.get('papel'))
          if (papelPg === 'admin' || papelPg === 'suporte') liberadoPg = true
          else {
            var msPg = $app.findRecordsByFilter(
              'matriculas',
              "user = {:u} && status = 'ativa'",
              '',
              1,
              0,
              { u: authPg.id },
            )
            if (msPg && msPg.length) liberadoPg = true
          }
        }
      }
    } catch (_pg3) {}
    if (!liberadoPg)
      return e.json(403, {
        codigo: 'ead_fechado',
        mensagem: 'A área de cursos ainda não está aberta para compra.',
      })
  }

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
    emailValido: function (v) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || ''))
    },
    // Orders exige valor como string com 2 casas ("197.00"), não número.
    reais: function (centavos) {
      return (Math.round(Number(centavos)) / 100).toFixed(2)
    },
    // O nome do comprador vem inteiro; Orders separa em first/last.
    primeiroNome: function (nome) {
      var p = String(nome || '').trim().split(/\s+/)
      return p[0] || ''
    },
    sobrenome: function (nome) {
      var p = String(nome || '').trim().split(/\s+/)
      if (p.length < 2) return ''
      return p.slice(1).join(' ')
    },
  }

  var app = $app
  var info = e.requestInfo()
  var corpo = info.body || {}
  var auth = info.auth

  var produtoSlug = comum.texto(corpo.produto_slug)
  var email = comum.texto(corpo.email).toLowerCase()
  var nome = comum.texto(corpo.nome)

  if (!produtoSlug)
    return e.json(400, { codigo: 'produto_obrigatorio', mensagem: 'Produto não informado.' })
  if (!comum.emailValido(email))
    return e.json(400, { codigo: 'email_invalido', mensagem: 'Informe um e-mail válido.' })
  if (nome.length < 2)
    return e.json(400, { codigo: 'nome_obrigatorio', mensagem: 'Informe seu nome.' })

  var produto = null
  try {
    produto = app.findFirstRecordByFilter('produtos', 'slug = {:s}', { s: produtoSlug })
  } catch (err) {}
  if (!produto || !produto.getBool('ativo')) {
    return e.json(404, {
      codigo: 'produto_indisponivel',
      mensagem: 'Produto indisponível.',
    })
  }

  // 0 é o marcador de "preço não definido" (PocketBase não guarda null em number).
  var valor = produto.getInt('preco_centavos')
  if (!valor || valor <= 0) {
    return e.json(409, {
      codigo: 'produto_sem_preco',
      mensagem: 'Este curso ainda não está à venda.',
    })
  }

  // Não vender duas vezes o que a pessoa já tem.
  var cursoIds = produto.getStringSlice('cursos') || []
  if (auth && cursoIds.length) {
    for (var i = 0; i < cursoIds.length; i++) {
      try {
        // sort '' — `matriculas` não tem o campo `created`.
        var ms = app.findRecordsByFilter(
          'matriculas',
          "user = {:u} && curso = {:c} && status = 'ativa'",
          '',
          1,
          0,
          { u: auth.id, c: cursoIds[i] },
        )
        if (ms && ms.length) {
          return e.json(409, {
            codigo: 'ja_matriculado',
            mensagem: 'Você já tem acesso a este curso.',
            area: '/ead/minha-area',
          })
        }
      } catch (err2) {}
    }
  }

  // Pedido primeiro: se o gateway falhar, fica o registro do que se tentou
  // (é o que permite recuperar a venda em vez de perder o cliente).
  var pedido = null
  try {
    var colPed = app.findCollectionByNameOrId('pedidos')
    pedido = new Record(colPed)
    pedido.set('produto', produto.id)
    if (auth) pedido.set('user', auth.id)
    pedido.set('email_comprador', email)
    pedido.set('nome_comprador', nome)
    pedido.set('valor_centavos', valor)
    pedido.set('status', 'pendente')
    pedido.set('gateway', 'mercadopago')
    app.save(pedido)
  } catch (err3) {
    // LOG OBRIGATÓRIO do motivo real: sem isto a resposta é sempre
    // "pedido_falhou" e ninguém sabe o que consertar.
    console.log('[ead] pedido_falhou: ' + err3.message)
    try {
      if (err3.data) console.log('[ead] pedido_falhou dados: ' + JSON.stringify(err3.data))
    } catch (_) {}
    return e.json(500, {
      codigo: 'pedido_falhou',
      mensagem: 'Não foi possível registrar o pedido.',
      detalhe: String(err3.message || '').substring(0, 200),
    })
  }

  var token = comum.segredo('MP_ACCESS_TOKEN')
  if (!token) {
    console.log('[ead] checkout sem MP_ACCESS_TOKEN configurado')
    return e.json(503, {
      codigo: 'pagamento_indisponivel',
      mensagem: 'Pagamento indisponível, tente em alguns minutos.',
      pedido: pedido.id,
    })
  }

  // ---- ambiente de teste ou produção ----
  //
  // ATENÇÃO (medido na doc do MP em 16/11): desde 19/11/2025 as credenciais de
  // teste do Checkout Pro TAMBÉM começam com APP_USR — igual às de produção.
  // Então NÃO existe como distinguir pelo prefixo do token. Quem diz é o
  // segredo MP_AMBIENTE, com o valor `teste`. Sem ele, assumimos produção, que
  // é o comportamento que já existia (e o mais seguro: nunca mandar um cliente
  // para o sandbox por engano).
  //
  // Com `teste`, usamos o link de sandbox quando o gateway oferece um. Sem
  // isso, quem paga com cartão de teste cai no ambiente real e o teste não
  // conclui.
  var ambiente = comum.segredo('MP_AMBIENTE').toLowerCase().trim()
  var ehTeste = ambiente === 'teste' || ambiente === 'sandbox'

  var base = comum.segredo('EAD_URL_PUBLICA') || 'https://wms-base-eficiencia-c56b6.goskip.app'
  var titulo = produto.getString('titulo') || produtoSlug
  var idemKey = 'pedido-' + pedido.id

  // ---- 1. Orders (caminho novo) ----
  //
  // NOTA IMPORTANTE (medido na doc em 16/11): Orders NÃO tem `notification_url`
  // no body — foi removido de propósito. No fluxo novo a notificação se
  // configura SÓ no painel do MP (Integrações → Webhooks → evento "Order"),
  // apontando para /backend/v1/webhooks/mercadopago.
  //
  // Consequência prática: se a URL não estiver cadastrada no painel, o
  // checkout funciona (o cliente paga) mas o acesso NÃO é liberado na hora.
  // Quem salva nesse caso é a reconciliação de 15 min, que consulta o gateway
  // pelo external_reference sem depender de notificação nenhuma.
  //
  // O ramo de Preferences abaixo MANTÉM `notification_url` porque lá o campo
  // existe e funciona.
  var corpoOrders = {
    type: 'online',
    // Checkout Pro no Orders só aceita `manual`: o processamento acontece
    // depois, no ambiente do Mercado Pago.
    processing_mode: 'manual',
    total_amount: comum.reais(valor),
    external_reference: pedido.id,
    payer: {
      email: email,
      first_name: comum.primeiroNome(nome),
      last_name: comum.sobrenome(nome),
    },
    items: [
      {
        title: titulo,
        quantity: 1,
        unit_price: comum.reais(valor),
      },
    ],
    config: {
      statement_descriptor: 'WMS EAD',
      online: {
        success_url: base + '/ead/obrigado?pedido=' + pedido.id,
        pending_url: base + '/ead/obrigado?pedido=' + pedido.id,
        failure_url: base + '/ead/obrigado?pedido=' + pedido.id,
      },
    },
  }
  if (base.indexOf('https://') === 0) corpoOrders.config.online.auto_return = 'approved'

  var link = ''
  var usou = ''
  var ultimoErro = ''

  try {
    var rOrders = $http.send({
      url: 'https://api.mercadopago.com/v1/orders',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idemKey,
      },
      body: JSON.stringify(corpoOrders),
      timeout: 25,
    })
    if (rOrders && rOrders.statusCode >= 200 && rOrders.statusCode < 300) {
      var dOrders = {}
      try {
        dOrders = JSON.parse(toString(rOrders.body))
      } catch (_) {}
      if (dOrders.checkout_url) {
        link = String(dOrders.checkout_url)
        usou = 'orders'
        // Log do link para conferir no teste se o MP mandou para o sandbox.
        // Em Orders o domínio do checkout_url muda conforme o ambiente, e não
        // existe um campo separado de sandbox como nas preferências.
        console.log('[ead] orders checkout_url (' + (ehTeste ? 'TESTE' : 'PRODUCAO') + '): ' + link)
        try {
          pedido.set('gateway', 'mercadopago-orders')
          if (dOrders.id) pedido.set('order_id', String(dOrders.id))
          app.save(pedido)
        } catch (errOrd) {
          console.log('[ead] nao gravou order_id: ' + errOrd.message)
        }
      } else {
        ultimoErro = 'orders sem checkout_url'
      }
    } else {
      ultimoErro = 'orders HTTP ' + (rOrders ? rOrders.statusCode : 'sem resposta')
      try {
        console.log('[ead] orders recusou: ' + ultimoErro + ' ' + toString(rOrders.body).substring(0, 300))
      } catch (_) {}
    }
  } catch (errOrders) {
    ultimoErro = 'orders exception: ' + errOrders.message
    console.log('[ead] ' + ultimoErro)
  }

  // ---- 2. Preferences (queda, enquanto a conta não aceitar Orders) ----
  if (!link) {
    var preferencia = {
      items: [
        {
          id: produtoSlug,
          title: titulo,
          quantity: 1,
          currency_id: produto.getString('moeda') || 'BRL',
          unit_price: valor / 100,
        },
      ],
      payer: { name: nome, email: email },
      external_reference: pedido.id,
      back_urls: {
        success: base + '/ead/obrigado?pedido=' + pedido.id,
        pending: base + '/ead/obrigado?pedido=' + pedido.id,
        failure: base + '/ead/obrigado?pedido=' + pedido.id,
      },
      notification_url: base + '/backend/v1/webhooks/mercadopago',
      statement_descriptor: 'WMS EAD',
    }
    if (base.indexOf('https://') === 0) preferencia.auto_return = 'approved'

    try {
      var rPref = $http.send({
        url: 'https://api.mercadopago.com/checkout/preferences',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKey,
        },
        body: JSON.stringify(preferencia),
        timeout: 25,
      })
      if (rPref && rPref.statusCode >= 200 && rPref.statusCode < 300) {
        var dPref = {}
        try {
          dPref = JSON.parse(toString(rPref.body))
        } catch (_) {}
        // No modo teste, sandbox_init_point é o que leva a pagar com cartão
        // de teste. Em produção, init_point.
        link = ehTeste
          ? dPref.sandbox_init_point || dPref.init_point || ''
          : dPref.init_point || dPref.sandbox_init_point || ''
        usou = 'preferences'
        try {
          pedido.set('gateway', 'mercadopago')
          if (dPref.id) pedido.set('pref_id', String(dPref.id))
          app.save(pedido)
        } catch (errPref) {
          console.log('[ead] nao gravou pref_id: ' + errPref.message)
        }
      } else {
        console.log(
          '[ead] preferences recusou: HTTP ' +
            (rPref ? rPref.statusCode : 'sem resposta') +
            ' ' +
            toString(rPref.body).substring(0, 300),
        )
      }
    } catch (errPref2) {
      console.log('[ead] preferences exception: ' + errPref2.message)
    }
  }

  if (!link) {
    console.log('[ead] checkout sem link. orders: ' + ultimoErro)
    return e.json(503, {
      codigo: 'pagamento_indisponivel',
      mensagem: 'Pagamento indisponível, tente em alguns minutos.',
      pedido: pedido.id,
    })
  }

  return e.json(200, { pedido: pedido.id, link: link, api: usou })
})
