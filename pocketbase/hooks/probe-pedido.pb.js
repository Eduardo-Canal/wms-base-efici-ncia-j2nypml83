// PROBE — le o pedido criado no teste do checkout para confirmar que o valor
// gravado veio do BANCO (19700) e nao do corpo da requisicao (1 centavo).
// Apagado logo depois.
routerAdd('GET', '/backend/v1/probe-pedido', (e) => {
  var out = { pedidos: [] }
  try {
    var rs = $app.findRecordsByFilter('pedidos', "id != ''", '-created', 5, 0)
    for (var i = 0; i < rs.length; i++) {
      out.pedidos.push({
        id: rs[i].id,
        produto: rs[i].getString('produto'),
        valor_centavos: rs[i].getInt('valor_centavos'),
        status: rs[i].getString('status'),
        email: rs[i].getString('email_comprador'),
      })
    }
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
