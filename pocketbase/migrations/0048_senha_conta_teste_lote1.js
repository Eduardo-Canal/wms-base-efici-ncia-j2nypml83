// 0048_senha_conta_teste_lote1.js
//
// A 0044 criou `teste.admin.lote1@exemplo.com` com senha aleatoria que so foi
// para o log da migration, e esse log nao aparece no list_logs. Esta migration
// define senha conhecida para a conta de teste do lote.
//
// SEGURO PORQUE: a conta e identificavel pelo padrao que o dono pediu
// ("teste"), e sera apagada no fim do lote (migration 0051).

migrate(
  (app) => {
    const EMAIL = 'teste.admin.lote1@exemplo.com'
    const SENHA = 'TesteLote1#2026'

    let u = null
    try {
      u = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      console.log('[ead] conta de teste ' + EMAIL + ' nao existe; nada feito')
      return
    }
    if (!u) return

    try {
      u.set('password', SENHA)
      u.set('passwordConfirm', SENHA)
      u.set('papel', 'admin')
      u.set('verified', true)
      app.save(u)
      console.log('[ead] senha da conta de teste definida para os testes do lote')
    } catch (err) {
      console.log('[ead] falha ao definir senha da conta de teste: ' + err.message)
    }
  },
  (app) => {
    // Reverter nao faz sentido: a conta sera removida em migration propria.
  },
)
