// 0042_pagamentos_conferencia.js
//
// REVISÃO EXTERNA, item 5 (plano B do webhook do Mercado Pago).
//
// O QUE ESTA MIGRATION FAZ:
// acrescenta `observacao` em `pagamentos`. Quando um pagamento aprovado existe
// mas NÃO casa com nenhum pedido (valor diferente, ou data anterior ao pedido),
// o webhook não libera o acesso — marca o pagamento com o motivo aqui, para o
// dono conferir no painel. Sem esse campo, o pagamento ficava indistinguível
// de "sem pedido ainda" e ninguém via o dinheiro parado.
//
// POR QUE MIGRATION NOVA: mudar schema em migration já aplicada não tem efeito
// — a 0035 me ensinou isso em 16/11 (campo editado depois de aplicada nunca
// existiu e o save falhou em silêncio). Migration nova é a regra do projeto.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    if (!col.fields.getByName('observacao')) {
      col.fields.add(new TextField({ name: 'observacao', required: false, max: 200 }))
      app.save(col)
      console.log('[ead] pagamentos: campo observacao criado')
    } else {
      console.log('[ead] pagamentos: observacao já existe')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pagamentos')
      if (col.fields.getByName('observacao')) {
        col.fields.removeByName('observacao')
        app.save(col)
      }
    } catch (_) {}
  },
)
