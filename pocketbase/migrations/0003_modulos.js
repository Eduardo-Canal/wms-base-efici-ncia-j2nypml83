// 0003_modulos
migrate(
  (app) => {
    const admin = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    const c = new Collection({
      type: 'base',
      name: 'modulos',
      listRule: `${admin} || curso.publicado = true`,
      viewRule: `${admin} || curso.publicado = true`,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'curso',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('cursos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'titulo', type: 'text', required: true, max: 160 },
        { name: 'slug', type: 'text', required: false, max: 120 },
        { name: 'ordem', type: 'number', required: true, onlyInt: true, min: 0 },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_modulos_curso_ordem ON modulos (curso, ordem)',
        'CREATE INDEX idx_modulos_slug ON modulos (slug)',
      ],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('modulos'))
  },
)
