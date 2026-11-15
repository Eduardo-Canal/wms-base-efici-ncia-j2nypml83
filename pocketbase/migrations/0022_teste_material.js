// 0022_teste_material — TESTE: cria matrícula para a conta de teste e põe um
// link de exemplo na aula 01, para provar que o endpoint entrega o link a quem
// tem matrícula. Desfeito pela 0023.
migrate(
  (app) => {
    var curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (e) {}
    if (!curso) return

    // usuário de teste (o mais recente com esse padrão)
    var u = null
    try {
      u = app.findFirstRecordByFilter('users', "email ~ 'exemplo.com'", '-created')
    } catch (e) {}
    if (u) {
      var existe = null
      try {
        existe = app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
          u: u.id,
          c: curso.id,
        })
      } catch (e) {}
      if (!existe) {
        var col = app.findCollectionByNameOrId('matriculas')
        var m = new Record(col)
        m.set('user', u.id)
        m.set('curso', curso.id)
        m.set('origem', 'compra')
        m.set('status', 'ativa')
        app.save(m)
      }
    }

    var a = null
    try {
      a = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a01-desafios-logistica-in-house',
      })
    } catch (e) {}
    if (a) {
      a.set('material_url', 'https://drive.google.com/file/d/EXEMPLO_TESTE/view?usp=sharing')
      app.save(a)
    }
  },
  (app) => {},
)
