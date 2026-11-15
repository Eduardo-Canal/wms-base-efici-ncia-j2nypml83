// 0009_pagamentos — payment_id unico = idempotencia do webhook. Fechada ao cliente.
migrate(
  (app) => {
    const c = new Collection({
      type: 'base',
      name: 'pagamentos',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'pedido',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('pedidos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'gateway', type: 'text', required: true, max: 40 },
        { name: 'payment_id', type: 'text', required: true, max: 120 },
        { name: 'status', type: 'text', required: true, max: 60 },
        { name: 'valor_centavos', type: 'number', required: true, onlyInt: true, min: 0 },
        { name: 'payload_bruto', type: 'json', required: false, maxSize: 524288 },
        { name: 'recebido_em', type: 'date', required: true },
        { name: 'processado', type: 'bool', required: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_pagamentos_payment ON pagamentos (payment_id)',
        'CREATE INDEX idx_pagamentos_pendentes ON pagamentos (processado)',
      ],
    })
    app.save(c)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('pagamentos'))
  },
)
