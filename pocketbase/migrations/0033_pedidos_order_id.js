// 0033_pedidos_order_id.js
//
// MIGRAÇÃO PARA A ORDERS API — campo próprio para o id da order.
//
// POR QUE UM CAMPO NOVO E NÃO REAPROVEITAR `pref_id`:
// `pref_id` guarda o id de uma PREFERÊNCIA (`202809963-920c288b-...`). A order
// tem outro id e outra vida (`ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9`). Colocar os
// dois no mesmo campo funciona até o dia em que alguém precisa saber qual
// gateway gerou qual — e aí não tem como. Dois campos, duas verdades.
//
// `pref_id` fica: pedidos antigos (se existirem) continuam legíveis.
//
// Índice único PARCIAL (WHERE order_id != ''): no SQLite, sem essa condição,
// o segundo pedido em diante viola o único porque todos têm order_id vazio.
// Foi exatamente esse o defeito que derrubou o checkout em 16/11 com pref_id.
migrate(
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos')

    if (!pedidos.fields.getByName('order_id')) {
      pedidos.fields.add(new TextField({ name: 'order_id', max: 120 }))
    }
    app.save(pedidos)

    // Recria o índice de forma idempotente.
    try {
      app.db().newQuery('DROP INDEX IF EXISTS idx_pedidos_order').execute()
    } catch (_) {}
    app
      .db()
      .newQuery("CREATE UNIQUE INDEX idx_pedidos_order ON pedidos (order_id) WHERE order_id != ''")
      .execute()
  },
  (app) => {
    try {
      app.db().newQuery('DROP INDEX IF EXISTS idx_pedidos_order').execute()
    } catch (_) {}
    try {
      const pedidos = app.findCollectionByNameOrId('pedidos')
      if (pedidos.fields.getByName('order_id')) {
        pedidos.fields.removeByName('order_id')
        app.save(pedidos)
      }
    } catch (_) {}
  },
)
