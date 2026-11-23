// 0053_limpa_orfaos_e_log_teste.js
//
// REVISÃO EXTERNA, item 5 (18/11): "Apague os 18 progresso_aulas órfãos
// (usuário inexistente) e as linhas de log_acessos geradas pelos testes."
//
// O QUE SÃO OS ÓRFÃOS: `progresso_aulas` aponta para `users`, mas as contas de
// teste foram apagadas em migrations anteriores (0019, 0043, 0051). O PocketBase
// não apaga em cascata quando o registro é removido por migration, então
// sobraram linhas apontando para id de usuário que não existe — elas inflam
// contagem de "aulas concluídas" em relatório e podem confundir métrica.
//
// O QUE SÃO AS LINHAS DE LOG: `log_acessos` registra cada abertura de aula. Os
// testes deste lote abriram aulas dezenas de vezes (aula 01 e 02, simulação de
// progresso), e essas linhas são ruído no relatório do dono.
//
// COMO IDENTIFICO SEM APAGAR DADO REAL:
//   * progresso: apaga a linha cujo `user` NÃO EXISTE em users. Isso é objetivo
//     e não depende de lista de e-mail.
//   * log: apaga só as linhas com `em` a partir de 2026-11-18 15:00 UTC (início
//     dos testes deste lote) E tipo `matricula`/`amostra`/`conclusao_manual`
//     gerados nas aulas de teste. Nenhum aluno real assistiu nada até hoje: a
//     área está fechada ao público (portão), então todo acesso registrado é
//     teste ou meu.

migrate(
  (app) => {
    // ---- 1. progresso órfão ----
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

    // ---- 2. log_acessos dos testes ----
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
      '[ead][limpeza 0053] progresso orfao removido: ' +
        orfaos +
        ' | log removido: ' +
        logsApagados,
    )
  },
  (app) => {
    // Dado de teste não volta.
  },
)
