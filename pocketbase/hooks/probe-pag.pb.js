// PROBE — reproduz exatamente o insert do webhook e devolve a mensagem do erro.
routerAdd('GET', '/backend/v1/probe-pag', (e) => {
  var out = { tentativa: '', erro: '', criado: '' }
  try {
    var col = $app.findCollectionByNameOrId('pagamentos')
    var p = new Record(col)
    p.set('gateway', 'mercadopago')
    p.set('payment_id', 'probe-999')
    p.set('status', 'recebido')
    p.set('valor_centavos', 0)
    p.set('recebido_em', new Date().toISOString())
    p.set('processado', false)
    out.tentativa = 'iso-com-T'
    $app.save(p)
    out.criado = p.id
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
