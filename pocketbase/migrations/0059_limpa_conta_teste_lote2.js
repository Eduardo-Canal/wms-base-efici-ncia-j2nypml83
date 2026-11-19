// 0059_limpa_conta_teste_lote2.js
//
// Remove a conta de teste do lote 2 (`teste.admin.lote2@exemplo.com`), criada só
// para eu conseguir rodar o fluxo autenticado — o OTP chega por e-mail e as
// caixas de @exemplo.com são descartadas pelo relay, então sem uma conta com
// senha conhecida eu não passaria da porta.
//
// POR QUE APAGAR: conta admin com senha conhecida não sobrevive ao turno. É a
// regra que o dono definiu depois do vazamento da 0048.
//
// Também apaga o que a conta de teste deixou: aviso de lançamento (o teste do
// item 8 registrou um). Nada mais dela foi criado.

migrate(
  (app) => {
    const EMAIL = 'teste.admin.lote2@exemplo.com'

    let u = null
    try {
      u = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {}
    if (!u) {
      console.log('[ead][lote2] conta de teste ja nao existe')
      return
    }

    const id = u.id

    // dependências
    try {
      const av = app.findRecordsByFilter('avisos_lancamento', 'user = {:u}', '', 50, 0, { u: id })
      for (let i = 0; i < av.length; i++) app.delete(av[i])
    } catch (_) {}
    try {
      const pd = app.findRecordsByFilter('prediagnosticos', 'user = {:u}', '', 50, 0, { u: id })
      for (let i = 0; i < pd.length; i++) app.delete(pd[i])
    } catch (_) {}
    try {
      const dg = app.findRecordsByFilter('diagnosticos', 'user = {:u}', '', 50, 0, { u: id })
      for (let i = 0; i < dg.length; i++) app.delete(dg[i])
    } catch (_) {}
    try {
      const rf = app.findRecordsByFilter('respostas_fixacao', 'user = {:u}', '', 50, 0, { u: id })
      for (let i = 0; i < rf.length; i++) app.delete(rf[i])
    } catch (_) {}
    try {
      const mt = app.findRecordsByFilter('matriculas', 'user = {:u}', '', 50, 0, { u: id })
      for (let i = 0; i < mt.length; i++) app.delete(mt[i])
    } catch (_) {}

    try {
      app.delete(u)
      console.log('[ead][lote2] conta de teste removida: ' + EMAIL)
    } catch (err) {
      console.log('[ead][lote2] falha ao remover conta de teste: ' + err.message)
    }
  },
  (app) => {
    // Nao recriar conta de teste com senha conhecida.
  },
)
