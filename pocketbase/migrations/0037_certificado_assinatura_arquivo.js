// 0037_certificado_assinatura_arquivo.js
//
// DEFEITO QUE ESTA MIGRATION CORRIGE (encontrado no teste de 16/11 16:49):
// eu acrescentei o campo `assinatura_arquivo` na migration 0035 DEPOIS de ela
// já ter sido aplicada. Migration aplicada não roda de novo — então o campo
// nunca existiu na coleção, o `c.set('assinatura_arquivo', ...)` falhou em
// silêncio no save e a verificação pública devolvia a rubrica VAZIA.
// (A emissão mostrava a URL porque ela vem do curso, não do certificado.)
//
// LIÇÃO registrada: para mudar schema, sempre uma migration NOVA. Editar uma
// já aplicada é o mesmo que não editar.
migrate(
  (app) => {
    const cert = app.findCollectionByNameOrId('certificados')
    if (!cert.fields.getByName('assinatura_arquivo')) {
      cert.fields.add(new TextField({ name: 'assinatura_arquivo', required: false, max: 200 }))
      app.save(cert)
      console.log('[ead] certificados: campo assinatura_arquivo criado')
    }
  },
  (app) => {
    try {
      const cert = app.findCollectionByNameOrId('certificados')
      if (cert.fields.getByName('assinatura_arquivo')) {
        cert.fields.removeByName('assinatura_arquivo')
        app.save(cert)
      }
    } catch (_) {}
  },
)
