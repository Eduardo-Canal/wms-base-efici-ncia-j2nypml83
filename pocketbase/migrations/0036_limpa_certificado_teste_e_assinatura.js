// 0036_limpa_certificado_teste_e_assinatura.js
//
// DUAS COISAS:
//
// 1. Remove o certificado de TESTE que eu mesmo emiti ao validar (16/11).
//    Autorizado pelo dono em 16/11 16:45 ("pode apagar seu teste de certificado").
//    Não apago pela API porque `certificados` tem deleteRule nulo — só o app
//    apaga. A migration roda como o app.
//    Só apaga o código exato do teste, e só se o nome do aluno for o do usuário
//    de teste: se por qualquer motivo aquele código for de alguém real, não toca.
//
// 2. Campo para a IMAGEM DA ASSINATURA (rubrica) no curso.
//    Decisão do dono (16/11 16:45): "vamos colocar uma imagem de assinatura
//    (rubrica), teremos que ter um download desta imagem e vincular ao
//    certificado".
//    Por que no CURSO e não no módulo: o certificado é POR CURSO (decisão
//    anterior dele), então a rubrica é do mesmo dono do certificado. Guardar por
//    módulo faria a mesma imagem ser enviada 12 vezes.
migrate(
  (app) => {
    // ---- 1. certificado de teste ----
    try {
      const c = app.findFirstRecordByFilter('certificados', "codigo = 'WMS-KPTW-9V8V'")
      if (c && String(c.getString('nome_aluno')) === 'Aluno Voucher') {
        app.delete(c)
        console.log('[ead] certificado de teste WMS-KPTW-9V8V removido')
      }
    } catch (_) {
      // não existe: nada a fazer
    }

    // ---- 2. imagem da assinatura no curso ----
    const cursos = app.findCollectionByNameOrId('cursos')
    if (!cursos.fields.getByName('cert_assinatura')) {
      cursos.fields.add(
        new FileField({
          name: 'cert_assinatura',
          required: false,
          maxSelect: 1,
          maxSize: 2097152, // 2 MB: rubrica é imagem pequena
          mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
          // NÃO é protegida para servir de <img> no certificado, mas isso
          // significa URl pública. Ver o aviso abaixo.
          protected: false,
          thumbs: [],
        }),
      )
    }
    // Aviso registrado no código: rubrica não é segredo (aparece no
    // certificado), então arquivo público é aceitável — diferente do PDF de
    // aula, que é conteúdo pago e vai por endpoint com matrícula.
    app.save(cursos)
  },
  (app) => {
    try {
      const cursos = app.findCollectionByNameOrId('cursos')
      if (cursos.fields.getByName('cert_assinatura')) {
        cursos.fields.removeByName('cert_assinatura')
        app.save(cursos)
      }
    } catch (_) {}
    // Reverter não recria o certificado de teste.
  },
)
