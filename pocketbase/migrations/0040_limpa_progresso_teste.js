// 0040_limpa_progresso_teste.js
//
// Zera o progresso do usuário de TESTE (aluno.voucher@exemplo.com) para eu
// poder validar a medição por tempo assistido do zero — as linhas de hoje
// foram criadas antes da regra automática existir (todas com concluida=true
// pelo antigo botão), e elas escondem o comportamento novo.
//
// Só toca no e-mail de teste. Não apaga progresso de aluno real.

migrate(
  (app) => {
    let user = null
    try {
      user = app.findAuthRecordByEmail('users', 'aluno.voucher@exemplo.com')
    } catch (_) {}
    if (!user) {
      console.log('[ead] limpa progresso teste: usuário de teste não existe')
      return
    }
    try {
      const linhas = app.findRecordsByFilter('progresso_aulas', 'user = {:u}', '', 500, 0, {
        u: user.id,
      })
      for (let i = 0; i < linhas.length; i++) {
        app.delete(linhas[i])
      }
      console.log('[ead] progresso de teste removido: ' + linhas.length + ' linha(s)')
    } catch (err) {
      console.log('[ead] limpa progresso teste falhou: ' + err.message)
    }
  },
  (app) => {
    // Irreversível de propósito: progresso de teste não volta.
  },
)
