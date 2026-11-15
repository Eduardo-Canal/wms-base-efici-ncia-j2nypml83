// 0021_material_url — o PDF passa a ser um LINK (Google Drive), não um arquivo
// dentro do PocketBase. Motivo: no Skip Cloud o storage é S3 e o hook antigo lia
// disco local ($app.dataDir()/storage/...), o que nunca funcionaria.
//
// Como funciona: o Eduardo cola o link de compartilhamento do Drive em
// `material_url`. O endpoint /material confere login + matrícula ATIVA antes de
// redirecionar para o Drive — então o link não aparece para visitante nem para
// aluno sem o curso.
//
// LIMITE HONESTO desta abordagem: quem tem matrícula recebe o link do Drive e
// pode repassá-lo. Para fechar isso de vez seria preciso PROXY do arquivo pelo
// servidor (o link nunca chega ao aluno). Fica como opção se o PDF vazar.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('aulas')
    var existe = false
    for (var i = 0; i < col.fields.length; i++) {
      if (col.fields[i].name === 'material_url') existe = true
    }
    if (existe) return
    col.fields.add(
      new TextField({
        name: 'material_url',
        max: 500,
        required: false,
      }),
    )
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('aulas')
      col.fields.removeByName('material_url')
      app.save(col)
    } catch (e) {}
  },
)
