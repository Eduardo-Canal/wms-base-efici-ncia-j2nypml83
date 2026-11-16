// 0030_pedidos_pref_id_parcial.js
//
// DEFEITO REAL no checkout: todo pedido novo falhava com "pedido_falhou".
//
// CAUSA: o índice único `idx_pedidos_pref` foi criado sobre `pref_id` SEM a
// condição parcial. `pref_id` só é preenchido DEPOIS que o Mercado Pago
// responde (é o id da preferência), então o primeiro pedido grava `pref_id = ''`
// — e o segundo pedido também. Dois registros com '' violam o índice único.
// Efeito: o primeiro pedido passaria, do segundo em diante tudo quebra. Na
// prática ninguém consegue comprar.
//
// CONSERTO: recriar o índice como ÚNICO PARCIAL, valendo só quando `pref_id`
// não está vazio. Vários pedidos podem estar "sem preferência ainda"; dois
// pedidos NÃO podem apontar para a mesma preferência do gateway.
//
// Ordem importa: remove o índice antigo ANTES de criar o novo, senão o
// PocketBase recusa por conflito de nome.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')

    // Remove o índice errado, se existir.
    try {
      col.removeIndex('idx_pedidos_pref')
    } catch (_) {
      /* já não existe */
    }

    col.addIndex(
      'idx_pedidos_pref',
      true, // único
      'pref_id',
      // A condição que faltava: só vale para preferência preenchida.
      "pref_id != ''",
    )

    app.save(col)
  },
  (app) => {
    // Volta ao formato anterior. Não é recomendado: ele quebra o checkout.
    try {
      const col = app.findCollectionByNameOrId('pedidos')
      col.removeIndex('idx_pedidos_pref')
      col.addIndex('idx_pedidos_pref', true, 'pref_id', '')
      app.save(col)
    } catch (_) {}
  },
)
