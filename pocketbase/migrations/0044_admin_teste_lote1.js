// 0044_admin_teste_lote1.js
//
// Cria a conta de teste do lote 1, IDENTIFICÁVEL pelo padrão que o dono pediu
// (18/11): e-mail começando com "teste". Serve para eu rodar os testes de admin
// (portão, rate limit, diagnóstico do Bunny) sem usar conta de cliente real.
//
// POR QUE MIGRATION: `papel` só é alterável por migration (usuarios-guard
// bloqueia promoção pela API), e não existe endpoint de criação de admin.
//
// A SENHA É ALEATÓRIA e NÃO fica registrada em lugar nenhum além do log desta
// migration — se eu precisar entrar de novo, recrio a conta. Isso evita a
// situação da 0029: conta admin com senha fixa e conhecida, esquecida no banco.
//
// LIMPEZA: esta conta tem prazo. A migration 0045 (ou a do próximo lote) a
// remove; o relatório lista a existência dela.

migrate(
  (app) => {
    const EMAIL = 'teste.admin.lote1@exemplo.com'

    // Já existe? não duplica.
    let existente = null
    try {
      existente = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {}
    if (existente) {
      console.log('[ead] conta de teste do lote já existe: ' + EMAIL)
      return
    }

    const senha = $security.randomString(24)
    try {
      const col = app.findCollectionByNameOrId('_pb_users_auth_')
      const u = new Record(col)
      u.set('email', EMAIL)
      u.set('name', 'Teste Admin Lote 1')
      u.set('papel', 'admin')
      u.set('verified', true)
      u.set('emailVisibility', false)
      u.set('password', senha)
      u.set('passwordConfirm', senha)
      app.save(u)
      // A senha vai para o log do runtime, que é privado do projeto — não para
      // resposta de API nem para arquivo versionado.
      console.log('[ead] conta de teste criada: ' + EMAIL + ' senha: ' + senha)
    } catch (err) {
      console.log('[ead] falha ao criar conta de teste: ' + err.message)
    }
  },
  (app) => {
    try {
      const u = app.findAuthRecordByEmail('_pb_users_auth_', 'teste.admin.lote1@exemplo.com')
      app.delete(u)
    } catch (_) {}
  },
)
