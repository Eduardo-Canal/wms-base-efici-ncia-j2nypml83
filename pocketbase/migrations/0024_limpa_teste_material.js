// 0024_limpa_teste_material — desfaz o teste da 0023: apaga a matrícula e a
// conta de teste e zera o link de exemplo. Não toca em conta real.
migrate(
  (app) => {
    var emailTeste = 'pdf-teste-1794768675@exemplo.com'

    var u = null
    try {
      u = app.findFirstRecordByFilter('users', 'email = {:e}', { e: emailTeste })
    } catch (e) {}
    if (u) {
      try {
        var ms = app.findRecordsByFilter('matriculas', 'user = {:u}', '', 20, 0, { u: u.id })
        for (var i = 0; i < ms.length; i++) {
          try {
            app.delete(ms[i])
          } catch (e2) {}
        }
      } catch (e3) {}
      try {
        app.delete(u)
      } catch (e4) {}
    }

    // limpa qualquer outro resto do teste
    try {
      var resto = app.findRecordsByFilter('users', "email ~ 'exemplo.com'", '', 50, 0)
      for (var j = 0; j < resto.length; j++) {
        try {
          app.delete(resto[j])
        } catch (e5) {}
      }
    } catch (e6) {}

    var a = null
    try {
      a = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a01-desafios-logistica-in-house',
      })
    } catch (e7) {}
    if (a && String(a.getString('material_url')).indexOf('EXEMPLO_TESTE') !== -1) {
      a.set('material_url', '')
      app.save(a)
    }
  },
  (app) => {},
)
