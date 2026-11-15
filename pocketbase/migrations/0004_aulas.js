// 0004_aulas — leitura publica FECHADA: `material` (PDF) nao pode vazar pela
// regra de linha. Catalogo e player consomem /backend/v1/* que filtra campos.
migrate(
  (app) => {
    const admin = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    const c = new Collection({
      type: 'base',
      name: 'aulas',
      listRule: admin,
      viewRule: admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'modulo',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('modulos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'slug', type: 'text', required: true, max: 160 },
        { name: 'titulo', type: 'text', required: true, max: 200 },
        { name: 'descricao', type: 'text', required: false, max: 4000 },
        { name: 'numero', type: 'text', required: true, max: 20 },
        { name: 'ordem', type: 'number', required: true, onlyInt: true, min: 0 },
        { name: 'duracao_seg', type: 'number', required: false, onlyInt: true, min: 0 },
        { name: 'publicado', type: 'bool', required: false },
        { name: 'amostra', type: 'bool', required: false },
        {
          name: 'material',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf'],
        },
        { name: 'pergunta_fixacao', type: 'text', required: false, max: 1000 },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_aulas_slug ON aulas (slug)',
        'CREATE UNIQUE INDEX idx_aulas_modulo_ordem ON aulas (modulo, ordem)',
      ],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('aulas'))
  },
)
