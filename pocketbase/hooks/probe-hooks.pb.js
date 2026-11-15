// Teste de descoberta: `__hooks` e require de arquivo local no runtime do Skip.
// Apagado em seguida.
routerAdd('GET', '/backend/v1/probe-hooks', (e) => {
  var info = { temVariavel: typeof __hooks !== 'undefined', valor: '', requireLocal: '', erro: '' }
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
