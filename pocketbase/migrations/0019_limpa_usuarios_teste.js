// 0019_limpa_usuarios_teste — remove apenas as contas criadas por MIM em teste
// (padrões @exemplo.com gerados hoje). Não toca em conta real de ninguém.
migrate(
  (app) => {
    var alvos = []
    try {
      alvos = app.findRecordsByFilter('users', "email ~ 'exemplo.com'", '', 200, 0)
    } catch (e) {
      return
    }
    for (var i = 0; i < (alvos || []).length; i++) {
      try {
        app.delete(alvos[i])
      } catch (e2) {}
    }
  },
  (app) => {},
)
