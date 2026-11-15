// 0023_teste_material_v2 — corrige o teste da 0022: lá eu ordenei por "-created"
// e `findFirstRecordByFilter` recusa esse campo (invalid sort field), então a
// matrícula nunca foi criada. Aqui busco pelo e-mail exato, sem ordenação.
// TESTE: desfeito pela 0024.
migrate(
  (app) => {
    var emailTeste = 'pdf-teste-1794768675@exemplo.com'
    var curso = null
    var u = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (e) {}
    try {
      u = app.findFirstRecordByFilter('users', 'email = {:e}', { e: emailTeste })
    } catch (e) {}

    if (curso && u) {
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
        console.log('[ead] teste: matricula criada para ' + emailTeste)
      }
    } else {
      console.log('[ead] teste: curso ou usuario de teste nao encontrado')
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
      console.log('[ead] teste: material_url definido na aula 01')
    }
  },
  (app) => {},
)
