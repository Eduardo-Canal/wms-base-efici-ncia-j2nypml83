// 0012_users_papel — campo papel + regras de acesso do users.
// NOTA (Jarves 15/11): a migration 0001 do pacote do Sistemas NAO foi aplicada
// (eu subi da 0002 em diante). Este arquivo cumpre o papel dela, com a correcao
// de nao criar "nome" duplicado: a colecao nativa ja tem `name`.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.fields.add(
      new SelectField({
        name: 'papel',
        required: true,
        maxSelect: 1,
        values: ['aluno', 'admin', 'suporte'],
      }),
    )

    // O campo nativo `verified` faz o papel de "email_verificado" — nao criar duplicado.
    // Campos protegidos (papel, verified, email) sao revertidos pelo hook
    // usuarios-guard.pb.js para quem nao e admin.
    users.listRule =
      'id = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    users.viewRule =
      'id = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = null

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('papel')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
