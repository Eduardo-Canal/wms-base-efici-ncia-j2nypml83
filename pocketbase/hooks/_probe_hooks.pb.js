// Teste de descoberta: este arquivo existe só para verificar se `__hooks` e
// require local funcionam no runtime do Skip Cloud. Será apagado em seguida.
routerAdd('GET', '/backend/v1/_probe_hooks', (e) => {
  var info = { temVariavel: typeof __hooks !== 'undefined', valor: '', erro: '' }
  try {
    if (typeof __hooks !== 'undefined') info.valor = String(__hooks)
    var m = require(__hooks + '/lib/probe_lib.js')
    info.requireLocal = 'ok'
    info.valorLib = m.marcador
  } catch (err) {
    info.requireLocal = 'falhou'
    info.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, info)
})
