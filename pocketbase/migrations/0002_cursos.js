/// referencia
// 0002_cursos — coleção de cursos. Slug único; nunca renomear (chave do dado).
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'cursos',
      listRule: 'publicado = true',
      viewRule: 'publicado = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'slug', type: 'text', required: true, max: 120 },
        { name: 'titulo', type: 'text', required: true, max: 160 },
        { name: 'descricao', type: 'text', required: false, max: 20000 },
        { name: 'resumo_1linha', type: 'text', required: false, max: 200 },
        { name: 'resultado_esperado', type: 'text', required: false, max: 2000 },
        { name: 'carga_min', type: 'number', required: false, onlyInt: true, min: 0 },
        {
          name: 'capa',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'publicado', type: 'bool', required: false },
        { name: 'ordem', type: 'number', required: true, onlyInt: true, min: 0 },
        { name: 'criado_em', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'atualizado_em', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cursos_slug ON cursos (slug)'],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('cursos'))
  },
)
