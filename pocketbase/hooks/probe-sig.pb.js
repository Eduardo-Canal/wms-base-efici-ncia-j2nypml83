// PROBE — o que o servidor le do header x-signature. Apagado depois.
routerAdd('POST', '/backend/v1/probe-sig', (e) => {
  var out = { headerBruto: '', ts: '', v1: '', esperado: '', igual: '' }
  try {
    var h = e.request.header.get('x-signature')
    out.headerBruto = String(h)
    var segredo = String($secrets.get('MP_WEBHOOK_SECRET', ''))
    var partes = String(h).split(',')
    for (var i = 0; i < partes.length; i++) {
      var kv = partes[i].split('=')
      if (kv.length < 2) continue
      if (kv[0].trim() === 'ts') out.ts = kv.slice(1).join('=').trim()
      if (kv[0].trim() === 'v1') out.v1 = kv.slice(1).join('=').trim()
    }
    var canonica = 'id:999;ts:' + out.ts + ';'
    out.esperado = String($security.hs256(canonica, segredo))
    out.igual = out.esperado === out.v1 ? 'SIM' : 'NAO'
    out.lenEsperado = out.esperado.length
    out.lenV1 = out.v1.length
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
