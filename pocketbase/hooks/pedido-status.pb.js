// pedido-status.pb.js — a tela de obrigado pergunta "já liberou?".
//
//   GET /backend/v1/pedido/{id}/status
//
// POR QUE EXISTE:
// o Mercado Pago devolve o comprador para /ead/obrigado antes de o webhook
// chegar. Sem este endpoint, a tela não tem o que consultar e o aluno vê
// "aguardando" mesmo já tendo pago — ou o contrário, vê "liberado" antes de a
// matrícula existir.
//
// O QUE ELE **NÃO** FAZ: não libera nada. Devolve apenas o status já gravado no
// banco. Se liberasse, qualquer pessoa abriria a URL com um id de pedido e
// ganharia o curso sem pagar. A liberação é sempre do webhook ou do cron.
//
// PRIVACIDADE: quem não é dono do pedido nem admin recebe 404 — nem 403. Um 403
// confirmaria que aquele id existe, o que já é informação sobre outra pessoa.
//
// Libs INLINE: require local não funciona no JSVM deste projeto.

routerAdd('GET', '/backend/v1/pedido/{id}/status', (e) => {
  const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

  let id = ''
  try {
    id = texto(e.request.pathValue('id'))
  } catch (_) {}
  if (!id) return e.json(400, { codigo: 'id_obrigatorio', mensagem: 'Pedido não informado.' })

  let pedido = null
  try {
    pedido = $app.findRecordById('pedidos', id)
  } catch (_) {}

  if (!pedido) {
    return e.json(404, { codigo: 'pedido_inexistente', mensagem: 'Pedido não encontrado.' })
  }

  // ---- quem pode ver ----
  const auth = e.requestInfo().auth
  let autorizado = false
  if (auth) {
    try {
      if (auth.collection().name === '_superusers') autorizado = true
      else {
        const papel = String(auth.get('papel'))
        // dono do pedido ou equipe
        autorizado =
          pedido.getString('user') === auth.id || papel === 'admin' || papel === 'suporte'
      }
    } catch (_) {}
  }

  // Convite: quem comprou como visitante não tem `user` no pedido, e a tela de
  // obrigado abre sem login. Nesse caso não dá para provar quem é — mas o
  // status devolvido é só isso, um status, sem nome, e-mail ou valor. Sem isso
  // o visitante que comprou nunca veria a confirmação na tela.
  if (!autorizado) {
    if (texto(pedido.getString('user'))) {
      // Pedido é de alguém logado: não revela nada a terceiros.
      return e.json(404, { codigo: 'pedido_inexistente', mensagem: 'Pedido não encontrado.' })
    }
    autorizado = true
  }

  if (!autorizado) {
    return e.json(404, { codigo: 'pedido_inexistente', mensagem: 'Pedido não encontrado.' })
  }

  return e.json(200, {
    status: texto(pedido.getString('status')),
    // Não expõe valor nem e-mail: a tela não precisa.
    pagamento: texto(pedido.getString('pagamento_id')),
  })
})
