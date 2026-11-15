// PROBE — conta aulas e módulos como admin (inclui rascunho). Apagado depois.
routerAdd('GET', '/backend/v1/probe-contagem', (e) => {
  var out = { modulos: 0, aulas: 0, amostras: 0, publicadas: 0, numeros: [], faltando: [] }
  try {
    out.modulos = $app.findRecordsByFilter('modulos', "id != ''", '', 100, 0).length
    var as = $app.findRecordsByFilter('aulas', "id != ''", 'ordem', 100, 0)
    out.aulas = as.length
    for (var i = 0; i < as.length; i++) {
      out.numeros.push(as[i].getString('numero'))
      if (as[i].getBool('amostra')) out.amostras++
      if (as[i].getBool('publicado')) out.publicadas++
    }
    // confere se as 20 numeracoes estao todas la
    for (var n = 1; n <= 20; n++) {
      var alvo = 'Aula ' + (n < 10 ? '0' + n : String(n))
      if (out.numeros.indexOf(alvo) === -1) out.faltando.push(alvo)
    }
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
