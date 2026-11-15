// 0011_log_acessos — fechada ao cliente; ip_hash nunca em texto puro.
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'log_acessos',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('users').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'aula',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('aulas').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['matricula', 'amostra'],
        },
        { name: 'ip_hash', type: 'text', required: true, max: 64 },
        { name: 'user_agent', type: 'text', required: false, max: 500 },
        { name: 'em', type: 'date', required: true },
      ],
      indexes: [
        'CREATE INDEX idx_log_aula_em ON log_acessos (aula, em)',
        'CREATE INDEX idx_log_user_em ON log_acessos (user, em)',
      ],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('log_acessos'))
  },
)
