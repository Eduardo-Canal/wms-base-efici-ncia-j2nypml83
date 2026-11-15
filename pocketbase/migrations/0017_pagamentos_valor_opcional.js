// 0017_pagamentos_valor_opcional — corrige um defeito real encontrado em teste:
// `valor_centavos` é required e min:0, e o PocketBase trata 0 como "blank" num
// campo numérico obrigatório. Resultado: o webhook não conseguia gravar o
// pagamento no momento em que ele chega (o valor só é conhecido DEPOIS de
// consultar o gateway). Erro capturado: "valor_centavos: cannot be blank".
//
// O certo é o campo ser opcional: a linha nasce sem valor e recebe o valor real
// vindo do gateway na mesma rodada. O que impede fraude não é o campo ser
// obrigatório — é o valor vir sempre do gateway, nunca do cliente.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('pagamentos')
    var campo = null
    for (var i = 0; i < col.fields.length; i++) {
      if (col.fields[i].name === 'valor_centavos') campo = col.fields[i]
    }
    if (!campo) return
    campo.required = false
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('pagamentos')
      var campo = null
      for (var i = 0; i < col.fields.length; i++) {
        if (col.fields[i].name === 'valor_centavos') campo = col.fields[i]
      }
      if (campo) {
        campo.required = true
        app.save(col)
      }
    } catch (e) {}
  },
)
