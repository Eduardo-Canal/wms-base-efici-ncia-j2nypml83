// 0057_admin_teste_lote2.js
//
// Conta de teste do lote 2, para eu conseguir rodar o fluxo autenticado (o OTP
// chega por e-mail e e-mail de @exemplo.com é descartado pelo relay, então não
// consigo ler o código para concluir o login).
//
// NOME NO PADRÃO QUE O DONO PEDIU: e-mail começando com "teste".
//
// ⚠ SENHA FORA DO REPOSITÓRIO: ao contrário da 0048 (que vazou uma senha no
// GitHub público), esta migration NÃO contém senha. Ela gera uma senha aleatória
// e grava no log do runtime, que é privado do projeto. Se eu precisar entrar de
// novo, gero outra.
//
// VIDA ÚTIL: apagada pela migration do próximo turno, junto com o diagnóstico
// temporário. Não é conta de operação.

migrate(
  (app) => {
    const EMAIL = 'teste.admin.lote2@exemplo.com'

    let existente = null
    try {
      existente = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {}
    if (existente) {
      console.log('[ead][lote2] conta de teste ja existe: ' + EMAIL)
      return
    }

    // Senha aleatoria: NAO vai para o codigo nem para o repositorio.
    const senha = $security.randomString(32)
    try {
      const col = app.findCollectionByNameOrId('_pb_users_auth_')
      const u = new Record(col)
      u.set('email', EMAIL)
      u.set('name', 'Teste Admin Lote 2')
      u.set('papel', 'admin')
      u.set('verified', true)
      u.set('emailVisibility', false)
      u.set('password', senha)
      u.set('passwordConfirm', senha)
      app.save(u)
      console.log('[ead][lote2] conta de teste criada. senha: ' + senha)
    } catch (err) {
      console.log('[ead][lote2] falha ao criar conta de teste: ' + err.message)
    }
  },
  (app) => {
    try {
      const u = app.findAuthRecordByEmail('_pb_users_auth_', 'teste.admin.lote2@exemplo.com')
      app.delete(u)
    } catch (_) {}
  },
)
