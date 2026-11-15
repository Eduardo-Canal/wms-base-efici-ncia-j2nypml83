// 0007_pedidos — criacao so por endpoint (checkout/webhook); dono ve o proprio.
migrate(
  (app) => {
    const admin = '@request.auth.papel = "admin"'
    const c = new Collection({
      type: 'base',
      name: 'pedidos',
      listRule: '@request.auth.id != "" && (user = @request.auth.id || ' + admin + ')',
      viewRule: '@request.auth.id != "" && (user = @request.auth.id || ' + admin + ')',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'produto',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('produtos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('users').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'email_comprador', type: 'text', required: true, max: 200 },
        { name: 'nome_comprador', type: 'text', required: true, max: 160 },
        { name: 'valor_centavos', type: 'number', required: true, onlyInt: true, min: 0 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'pago', 'recusado', 'cancelado', 'reembolsado'],
        },
        { name: 'gateway', type: 'text', required: true, max: 40 },
        { name: 'pref_id', type: 'text', required: false, max: 120 },
        { name: 'pagamento_id', type: 'text', required: false, max: 120 },
        { name: 'criado_em', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'atualizado_em', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_pedidos_pref ON pedidos (pref_id)',
        'CREATE INDEX idx_pedidos_email ON pedidos (email_comprador)',
        'CREATE INDEX idx_pedidos_status ON pedidos (status)',
      ],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('pedidos'))
  },
)
