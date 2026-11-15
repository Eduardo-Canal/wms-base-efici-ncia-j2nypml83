// PROBE — confirma que o valor do pedido veio do BANCO (19700), nao do corpo (1).
routerAdd('GET', '/backend/v1/probe-pedido', (e) => {
  var out = { pedidos: [] }
  try {
    var rs = $app.findRecordsByFilter('pedidos', "id != ''", '', 5, 0)
    for (var i = 0; i < rs.length; i++) {
      out.pedidos.push({
        id: rs[i].id,
        valor_centavos: rs[i].getInt('valor_centavos'),
        status: rs[i].getString('status'),
        email: rs[i].getString('email_comprador'),
        criado_em: rs[i].getString('criado_em'),
      })
    }
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
