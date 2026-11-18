// 0053_limpa_orfaos_e_log_teste.js
//
// REVISÃO EXTERNA, item 5: apagar `progresso_aulas` com usuário inexistente e
// as linhas de `log_acessos` geradas pelos testes deste lote.
//
// CRITÉRIO OBJETIVO: progresso cujo `user` não existe em `users`. Não depende
// de lista de e-mail, então não apaga dado de aluno real.
// LOG: linhas a partir de 2026-11-18 15:00 UTC — janela dos testes. A área está
// fechada ao público (portão), então todo acesso registrado é teste.

migrate(
  (app) => {
    let orfaos = 0
    try {
      const todos = app.findRecordsByFilter('progresso_aulas', "id != ''", '', 2000, 0)
      for (let i = 0; i < todos.length; i++) {
        const uid = String(todos[i].getString('user') || '')
        let existe = false
        if (uid) {
          try {
            app.findRecordById('_pb_users_auth_', uid)
            existe = true
          } catch (_) {
            existe = false
          }
        }
        if (!existe) {
          app.delete(todos[i])
          orfaos++
        }
      }
    } catch (err) {
      console.log('[ead] falha ao limpar progresso orfao: ' + err.message)
    }

    let logsApagados = 0
    try {
      const corte = '2026-11-18 15:00:00.000Z'
      const regs = app.findRecordsByFilter('log_acessos', 'em > {:c}', '', 2000, 0, { c: corte })
      for (let i = 0; i < regs.length; i++) {
        app.delete(regs[i])
        logsApagados++
      }
    } catch (err2) {
      console.log('[ead] falha ao limpar log_acessos: ' + err2.message)
    }

    console.log(
      '[ead][limpeza 0053] progresso orfao removido: ' + orfaos + ' | log removido: ' + logsApagados,
    )
  },
  (app) => {
    // Dado de teste não volta.
  },
)
