// 0005_aulas_midia — FECHADA ao cliente: video_id nunca sai do servidor.
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'aulas_midia',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'aula',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('aulas').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'provider', type: 'text', required: true, max: 40 },
        { name: 'video_id', type: 'text', required: true, max: 120 },
        {
          name: 'legendas',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['text/vtt', 'text/plain'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['upload', 'processando', 'pronto', 'erro'],
        },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_aulas_midia_aula ON aulas_midia (aula)'],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('aulas_midia'))
  },
)
