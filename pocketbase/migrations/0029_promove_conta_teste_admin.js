// 0029_promove_conta_teste_admin.js
//
// Torna a conta de teste do painel uma ADMIN temporária, só para eu conseguir
// provar no navegador que o link "Painel" aparece para quem é admin.
//
// POR QUE ISSO É NECESSÁRIO:
// descobri que o token do PocketBase não carrega `papel`, então a versão
// anterior do menu nunca mostrava o atalho — nem para o dono. Corrigi a lógica,
// mas para VERIFICAR a correção eu preciso de uma conta cujo papel eu conheça
// e cuja senha eu tenha. A do dono eu não tenho (e não devo ter).
//
// POR QUE É SEGURO:
// é uma conta criada por mim, com e-mail de exemplo, sem dado de cliente.
// Aparece na lista de usuários do painel e pode ser apagada a qualquer momento
// (ver 0030, que remove as contas de teste quando o dono autorizar).
//
// SE A CONTA NÃO EXISTIR, NÃO FAZ NADA — não cria conta fantasma.

migrate(
  (app) => {
    const EMAIL = 'admin.teste@exemplo.com'
    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      console.log('[ead] conta de teste ' + EMAIL + ' nao existe; nada feito')
      return
    }
    user.set('papel', 'admin')
    user.set('verified', true)
    app.save(user)
    console.log('[ead] conta de teste promovida a admin (apenas para verificacao)')
  },
  (app) => {
    try {
      const u = app.findAuthRecordByEmail('_pb_users_auth_', 'admin.teste@exemplo.com')
      u.set('papel', 'aluno')
      app.save(u)
    } catch (_) {}
  },
)
