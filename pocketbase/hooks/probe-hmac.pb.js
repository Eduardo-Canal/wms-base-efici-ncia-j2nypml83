// PROBE — por que a assinatura valida nao passou? Devolve o que o servidor
// calcula e o que ele enxerga do segredo. Apagado logo depois.
routerAdd('GET', '/backend/v1/probe-hmac', (e) => {
  var out = { segredoLen: 0, segredoAmostra: '', canonica: '', hs256: '', sha256: '', hexTeste: '' }
  try {
    var s = ''
    if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
      s = String($secrets.get('MP_WEBHOOK_SECRET', ''))
    }
    out.segredoLen = s.length
    out.segredoAmostra = s.substring(0, 4)
    var canonica = 'id:999;ts:123;'
    out.canonica = canonica
    out.hs256 = String($security.hs256(canonica, s))
    out.sha256 = String($security.sha256(canonica))
    out.hexTeste = String($security.sha256('abc'))
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
