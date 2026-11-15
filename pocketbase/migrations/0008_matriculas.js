// 0008_matriculas — criacao so por servidor (webhook/admin). Unico (user, curso).
migrate(
  (app) => {
    const admin = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    const c = new Collection({
      type: 'base',
      name: 'matriculas',
      listRule: 'user = @request.auth.id || ' + admin,
      viewRule: 'user = @request.auth.id || ' + admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('users').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'curso',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('cursos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'pedido',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('pedidos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['compra', 'manual', 'cortesia', 'importacao'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativa', 'suspensa', 'expirada', 'reembolsada'],
        },
        { name: 'expira_em', type: 'date', required: false },
        { name: 'criado_em', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_matriculas_user_curso ON matriculas (user, curso)'],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('matriculas'))
  },
)
