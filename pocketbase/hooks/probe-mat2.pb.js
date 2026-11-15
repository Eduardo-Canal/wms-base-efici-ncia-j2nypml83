// PROBE — cria a matricula de teste e devolve o erro real, se houver.
routerAdd('GET', '/backend/v1/probe-mat2', (e) => {
  var out = { passo: '', erro: '', user: '', curso: '', matricula: '' }
  try {
    var emailTeste = 'pdf-teste-1794768675@exemplo.com'
    var u = null
    out.passo = 'busca-user'
    try {
      u = $app.findFirstRecordByFilter('users', 'email = {:e}', { e: emailTeste })
    } catch (err1) {
      out.erro = 'busca user: ' + String(err1 && err1.message ? err1.message : err1)
      return e.json(200, out)
    }
    if (!u) {
      out.erro = 'user nao achado'
      return e.json(200, out)
    }
    out.user = u.id

    out.passo = 'busca-curso'
    var c = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    out.curso = c.id

    out.passo = 'cria-matricula'
    var col = $app.findCollectionByNameOrId('matriculas')
    var m = new Record(col)
    m.set('user', u.id)
    m.set('curso', c.id)
    m.set('origem', 'compra')
    m.set('status', 'ativa')
    $app.save(m)
    out.matricula = m.id
    out.passo = 'ok'
  } catch (err) {
    out.erro = out.passo + ': ' + String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
