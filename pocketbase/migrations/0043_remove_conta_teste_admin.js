// 0043_remove_conta_teste_admin.js
//
// AUTORIZADO pelo dono em 18/11: "autorizo uma migration nominal que apaga
// admin.teste@exemplo.com (id 0j0d7bb4tpo2imw) se existir, sem erro se não
// existir".
//
// POR QUE MIGRATION: `users` tem deleteRule = null — ninguém apaga conta pela
// API. A revisão externa (item 1) pediu a remoção da conta de teste que a
// migration 0029 promoveu a admin e nada desfez. Sem isto, fica uma conta com
// privilégio de administrador e senha que circulou em conversa.
//
// PROTEÇÃO: apaga pelo ID E pelo e-mail. Se o ID não bater com o e-mail, não
// apaga nada — evita apagar a conta errada caso o banco tenha sido recriado.
//
// Também limpa o que essa conta deixou para trás (matrículas, progresso,
// resgates), porque deixar órfão sujaria os relatórios de aluno.

migrate(
  (app) => {
    const ID = '0j0d7bb4tpo2imw'
    const EMAIL = 'admin.teste@exemplo.com'

    let user = null
    try {
      user = app.findRecordById('_pb_users_auth_', ID)
    } catch (_) {
      console.log('[ead] conta de teste ' + ID + ' nao existe; nada a remover')
      return
    }

    // Confere que é a conta certa: id e e-mail têm que casar.
    let emailReal = ''
    try {
      emailReal = String(user.get('email') || '').toLowerCase()
    } catch (_) {}
    if (emailReal !== EMAIL) {
      console.log(
        '[ead] ABORTADO: o id ' +
          ID +
          ' pertence a "' +
          emailReal +
          '", nao a "' +
          EMAIL +
          '". Nada foi apagado.',
      )
      return
    }

    // ---- limpa dependências antes ----
    try {
      const mats = app.findRecordsByFilter('matriculas', 'user = {:u}', '', 200, 0, { u: ID })
      for (let i = 0; i < mats.length; i++) app.delete(mats[i])
      console.log('[ead] matriculas removidas: ' + mats.length)
    } catch (_) {}

    try {
      const prog = app.findRecordsByFilter('progresso_aulas', 'user = {:u}', '', 500, 0, { u: ID })
      for (let i = 0; i < prog.length; i++) app.delete(prog[i])
      console.log('[ead] progresso removido: ' + prog.length)
    } catch (_) {}

    try {
      const resg = app.findRecordsByFilter('voucher_resgates', 'user = {:u}', '', 200, 0, { u: ID })
      for (let i = 0; i < resg.length; i++) app.delete(resg[i])
    } catch (_) {}

    // ---- apaga a conta ----
    try {
      app.delete(user)
      console.log('[ead] conta de teste removida: ' + EMAIL)
    } catch (err) {
      console.log('[ead] falha ao remover conta de teste: ' + err.message)
    }
  },
  (app) => {
    // Irreversível de propósito: não recriar conta de teste com senha conhecida.
  },
)
