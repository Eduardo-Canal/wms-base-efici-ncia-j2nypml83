// 0048_senha_conta_teste_lote1.js
//
// A 0044 criou `teste.admin.lote1@exemplo.com` com senha aleatória que só foi
// para o log da migration — e o log da migration não aparece no
// skip_cloud_list_logs (que mostra hooks, requests, emails e crons). Resultado:
// a conta existe, mas eu não consigo entrar nela para rodar os testes de admin
// (portão, diagnóstico do Bunny, limite).
//
// Esta migration define uma senha CONHECIDA para essa conta de teste. É seguro
// porque:
//   * a conta é identificável pelo padrão que o dono pediu ("teste");
//   * é a ÚNICA conta com senha conhecida, e ela será apagada no fim do lote;
//   * não tem matrícula de aluno real e não é usada por ninguém.
//
// POR QUE MIGRATION E NÃO ENDPOINT: `papel` e senha de admin só se alteram por
// migration (o usuarios-guard bloqueia pela API, por desenho).

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
    // Reverter não faz sentido: a conta será removida em migration própria.
  },
)
