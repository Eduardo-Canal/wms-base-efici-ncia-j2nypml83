// 0050_banco_ead_sem_admin.js
//
// ITEM 3 DA REVISÃO (18/11). O dono perguntou o que é a conta "Banco_ead"
// (id ihdaihfvuldob0v, papel admin, SEM e-mail, com matrícula) e determinou:
// "Se for conta de serviço do Skip, retire o papel admin e a matrícula; o Skip
// já tem o superusuário."
//
// O QUE ELA É, pelo que o banco mostra:
//   * criada em 2026-11-15 03:40, quatro minutos depois do provisionamento do
//     Skip Cloud (03:38, mesma janela dos segredos de sistema);
//   * nome "Banco_ead", SEM e-mail (a coleção exige e-mail, então ela nasceu de
//     um caminho que não é o signup público);
//   * tem matrícula ativa no curso.
// Isso é consistente com conta de serviço/seed criada para o banco ter um dono
// inicial antes de existir usuário real. NÃO é conta de aluno e não é a do dono
// (a do dono é eduardo.canal@zionlogtec.com.br, promovida pelas 0026/0027/0028).
//
// O QUE ESTA MIGRATION FAZ (exatamente o pedido):
//   * tira `papel = admin` → vira `aluno`, sem poderes de painel;
//   * remove a matrícula, para não aparecer como aluno matriculado nos
//     relatórios de receita/progresso;
//   * NÃO apaga a conta: o Skip pode referenciá-la internamente, e uma conta sem
//     papel de admin e sem matrícula é inofensiva.
//
// IDEMPOTENTE: rodar de novo não muda nada.

migrate(
  (app) => {
    const ID = 'ihdaihfvuldob0v'

    let u = null
    try {
      u = app.findRecordById('_pb_users_auth_', ID)
    } catch (_) {
      console.log('[ead] conta de servico ' + ID + ' nao existe; nada feito')
      return
    }
    if (!u) return

    // Confere pelo nome para não mexer em conta errada se o banco mudar.
    const nome = String(u.getString('name') || '')
    if (nome !== 'Banco_ead') {
      console.log('[ead] ABORTADO: id ' + ID + ' pertence a "' + nome + '", nao a Banco_ead.')
      return
    }

    // 1. tira o papel de admin
    try {
      if (String(u.get('papel') || '') !== 'aluno') {
        u.set('papel', 'aluno')
        app.save(u)
        console.log('[ead] Banco_ead: papel admin removido (agora aluno)')
      } else {
        console.log('[ead] Banco_ead: ja era aluno')
      }
    } catch (err) {
      console.log('[ead] falha ao rebaixar Banco_ead: ' + err.message)
    }

    // 2. remove matrículas
    try {
      const mats = app.findRecordsByFilter('matriculas', 'user = {:u}', '', 100, 0, { u: ID })
      for (let i = 0; i < mats.length; i++) app.delete(mats[i])
      console.log('[ead] Banco_ead: matriculas removidas: ' + mats.length)
    } catch (err2) {
      console.log('[ead] falha ao remover matriculas do Banco_ead: ' + err2.message)
    }
  },
  (app) => {
    // Não recria admin nem matrícula: o pedido é que ela não tenha.
  },
)
