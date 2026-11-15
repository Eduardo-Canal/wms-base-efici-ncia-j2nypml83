// 0026_promove_admin_eduardo.js
//
// Promove a conta do dono a `admin` do EAD.
//
// POR QUE VIA MIGRATION E NÃO POR ENDPOINT:
// o hook usuarios-guard.pb.js impede qualquer não-admin de mudar `papel` —
// inclusive o próprio. É proteção correta (sem ela, qualquer visitante se
// promoveria a admin pelo signup), mas cria um problema de ovo e galinha: o
// primeiro admin não existe e ninguém consegue criar.
// Migration roda como superuser, então é o lugar certo para essa promoção
// única e auditável — fica no histórico, com data e motivo.
//
// SEGURANÇA: promove UM e-mail específico, não "o primeiro usuário". Se esse
// e-mail não existir, a migration não faz nada e não cria conta (criar conta
// aqui deixaria uma senha desconhecida e um usuário fantasma).
//
// IDEMPOTENTE: se já for admin, não muda nada.

migrate(
  (app) => {
    const EMAIL = 'eduardo.canal@zionlogtec.com.br'

    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      // conta ainda não existe: nada a promover.
      console.log('[ead] promocao: conta ' + EMAIL + ' nao existe; nada feito')
      return
    }

    const atual = String(user.get('papel') || '')
    if (atual === 'admin') {
      console.log('[ead] promocao: ' + EMAIL + ' ja e admin; nada feito')
      return
    }

    user.set('papel', 'admin')
    // Conta do dono não precisa de verificação de e-mail para operar o painel.
    user.set('verified', true)
    app.save(user)
    console.log('[ead] promocao: ' + EMAIL + ' agora e admin')
  },
  (app) => {
    // Reverter rebaixa de volta para aluno. Não apaga a conta.
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'eduardo.canal@zionlogtec.com.br')
      user.set('papel', 'aluno')
      app.save(user)
    } catch (_) {
      /* conta removida: nada a reverter */
    }
  },
)
