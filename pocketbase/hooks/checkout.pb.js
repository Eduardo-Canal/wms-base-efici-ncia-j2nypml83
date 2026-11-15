// POST /backend/v1/checkout — cria preferência no Mercado Pago Checkout Pro.
// Regras: o VALOR VEM DO BANCO (qualquer preço no corpo é ignorado); produto
// inativo ou sem preço recusa; quem já tem matrícula recebe 409;
// external_reference = id do pedido, para o webhook casar sem adivinhar.
// Libs inlinadas: require local não funciona no Skip.
routerAdd('POST', '/backend/v1/checkout', (e) => {
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
    jsonErro: function (e, status, codigo, mensagem) {
      return e.json(status, { codigo: codigo, mensagem: mensagem })
    },
  }

  var app = $app
  var info = e.requestInfo()
  var corpo = info.body || {}
  var auth = info.auth

  var produtoSlug = comum.texto(corpo.produto_slug)
  var email = comum.texto(corpo.email).toLowerCase()
  var nome = comum.texto(corpo.nome)

  if (!produtoSlug) return comum.jsonErro(e, 400, 'produto_obrigatorio', 'Produto não informado.')
  if (!comum.emailValido(email))
    return comum.jsonErro(e, 400, 'email_invalido', 'Informe um e-mail válido.')
  if (nome.length < 2) return comum.jsonErro(e, 400, 'nome_obrigatorio', 'Informe seu nome.')

  var produto = null
  try {
    produto = app.findFirstRecordByFilter('produtos', 'slug = {:s}', { s: produtoSlug })
  } catch (err) {}
  if (!produto || !produto.getBool('ativo')) {
    return comum.jsonErro(e, 404, 'produto_indisponivel', 'Produto indisponível.')
  }

  // 0 é o marcador de "preço não definido" (PocketBase não guarda null em number).
  var valor = produto.getInt('preco_centavos')
  if (!valor || valor <= 0) {
    return comum.jsonErro(e, 409, 'produto_sem_preco', 'Este curso ainda não está à venda.')
  }

  // R8 — não vender duas vezes o que a pessoa já tem.
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

  // Pedido primeiro: se o gateway falhar, fica o registro do que se tentou.
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
    return comum.jsonErro(e, 500, 'pedido_falhou', 'Não foi possível registrar o pedido.')
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

  var base = comum.segredo('EAD_URL_PUBLICA') || 'https://wms-base-eficiencia-c56b6.goskip.app'
  var preferencia = {
    items: [
      {
        id: produto.getString('slug'),
        title: produto.getString('titulo'),
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

  var resp = null
  try {
    resp = $http.send({
      url: 'https://api.mercadopago.com/checkout/preferences',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'pedido-' + pedido.id,
      },
      body: JSON.stringify(preferencia),
      timeout: 25,
    })
  } catch (err4) {
    console.log('[ead] MP indisponivel: ' + err4.message)
    return e.json(503, {
      codigo: 'pagamento_indisponivel',
      mensagem: 'Pagamento indisponível, tente em alguns minutos.',
      pedido: pedido.id,
    })
  }

  if (!resp || resp.statusCode < 200 || resp.statusCode >= 300) {
    console.log('[ead] MP respondeu ' + (resp ? resp.statusCode : 'sem resposta'))
    return e.json(503, {
      codigo: 'pagamento_indisponivel',
      mensagem: 'Pagamento indisponível, tente em alguns minutos.',
      pedido: pedido.id,
    })
  }

  var dados = {}
  try {
    dados = JSON.parse(toString(resp.body))
  } catch (err5) {}
  try {
    if (dados.id) {
      pedido.set('pref_id', String(dados.id))
      app.save(pedido)
    }
  } catch (err6) {
    console.log('[ead] nao gravou pref_id: ' + err6.message)
  }

  var link = dados.init_point || dados.sandbox_init_point || ''
  if (!link) {
    return comum.jsonErro(
      e,
      502,
      'gateway_resposta_invalida',
      'O pagamento não retornou um link. Tente de novo.',
    )
  }

  return e.json(200, { pedido: pedido.id, link: link })
})
