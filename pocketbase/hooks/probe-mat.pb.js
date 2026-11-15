// PROBE — por que a matricula de teste nao foi criada?
routerAdd('GET', '/backend/v1/probe-mat', (e) => {
  var out = { usuarios: [], matriculas: [], erro: '' }
  try {
    var us = $app.findRecordsByFilter('users', "id != ''", '', 20, 0)
    for (var i = 0; i < us.length; i++) out.usuarios.push(us[i].getString('email'))
    var ms = $app.findRecordsByFilter('matriculas', "id != ''", '', 20, 0)
    for (var j = 0; j < ms.length; j++)
      out.matriculas.push(ms[j].getString('user') + '|' + ms[j].getString('status'))
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
