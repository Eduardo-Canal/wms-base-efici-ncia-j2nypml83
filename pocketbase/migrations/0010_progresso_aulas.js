// 0010_progresso_aulas — cada aluno ve e edita so o proprio progresso.
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'progresso_aulas',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: 'user = @request.auth.id && aula.publicado = true',
      updateRule: 'user = @request.auth.id',
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('users').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'aula',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('aulas').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'concluida', type: 'bool', required: false },
        { name: 'posicao_seg', type: 'number', required: false, onlyInt: true, min: 0 },
        { name: 'atualizado_em', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_progresso_user_aula ON progresso_aulas (user, aula)'],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('progresso_aulas'))
  },
)
