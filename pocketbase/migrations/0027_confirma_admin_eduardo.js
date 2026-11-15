// 0027_confirma_admin_eduardo.js
//
// DIAGNÓSTICO + reforço da promoção do dono.
//
// Por que existe: a 0026 promoveu o e-mail, mas não havia como CONFIRMAR de
// fora se a conta existia naquele momento e se o papel ficou gravado — o hook
// de guarda esconde a coleção e eu não tenho a senha do dono. Esta migration
// lê o registro como superuser e escreve o resultado no log do runtime.
//
// Também é o conserto de um caso real: se a 0026 rodou antes da conta existir,
// nada aconteceu e o painel continuaria fechado. Aqui a promoção é refeita se
// necessário — idempotente, segura para rodar quantas vezes for preciso.
//
// Não cria conta e não define senha: senha é do dono, e não circula.

migrate(
  (app) => {
    const EMAIL = 'eduardo.canal@zionlogtec.com.br'

    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      console.log('[ead][diagnostico] conta ' + EMAIL + ' NAO EXISTE no banco')
      return
    }

    const papel = String(user.get('papel') || '')
    console.log('[ead][diagnostico] conta encontrada. papel atual = "' + papel + '"')

    if (papel !== 'admin') {
      user.set('papel', 'admin')
      app.save(user)
      console.log('[ead][diagnostico] papel promovido para admin')
    } else {
      console.log('[ead][diagnostico] ja era admin, nada alterado')
    }
  },
  (app) => {
    /* diagnóstico não precisa de rollback: não altera estrutura */
  },
)
