// 0006_produtos — preco 0 = sem preco; catalogo exige ativo && preco > 0.
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'produtos',
      listRule: 'ativo = true && preco_centavos > 0',
      viewRule: 'ativo = true && preco_centavos > 0',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'slug', type: 'text', required: true, max: 120 },
        { name: 'titulo', type: 'text', required: true, max: 160 },
        { name: 'descricao', type: 'text', required: false, max: 20000 },
        { name: 'preco_centavos', type: 'number', required: false, onlyInt: true, min: 0 },
        { name: 'moeda', type: 'text', required: true, max: 3 },
        {
          name: 'cursos',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('cursos').id,
          maxSelect: 10,
          cascadeDelete: false,
        },
        {
          name: 'capa',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'ativo', type: 'bool', required: false },
        { name: 'ordem', type: 'number', required: true, onlyInt: true, min: 0 },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_produtos_slug ON produtos (slug)'],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('produtos'))
  },
)
