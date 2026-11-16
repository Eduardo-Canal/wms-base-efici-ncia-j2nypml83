// 0035_partes_e_certificado.js
//
// DUAS DECISÕES DO DONO (16/11, 16:00), registradas aqui porque o código muda
// conforme elas e quem mexer depois precisa saber:
//
// (a) "Capítulo 2 = mais módulos do MESMO curso."
//     Por isso o curso NÃO se multiplica: quem comprou o Capítulo 1 recebe o
//     Capítulo 2 ao publicar, sem nova compra. O que faltava era um nível de
//     agrupamento acima do módulo — hoje o curso é plano e 12 módulos soltos
//     não mostram divisão nenhuma. Entra a coleção `partes` (capítulo).
//
// (b) "O certificado é por CURSO." (corrigindo o pedido inicial, que era por
//     módulo). Então os dados de emissão vivem no CURSO: título, texto, carga
//     horária, assinante. O MÓDULO contribui com o que ele certifica (carga e
//     a lista de conteúdo), que é o que aparece no corpo do certificado.
//
// COMPATIBILIDADE: `modulos.parte` é OPCIONAL. Módulo sem parte continua
// funcionando exatamente como hoje (aparece como "Capítulo único"), então nada
// do que já existe quebra e a tela não obriga a reorganizar.
//
// Por que não usar o rótulo do módulo para fingir capítulo ("M7 · Cap 2"):
// porque aí o progresso, o certificado e a navegação não têm onde se apoiar.
// Módulo precisa continuar sendo unidade limpa.
migrate(
  (app) => {
    const cursos = app.findCollectionByNameOrId('cursos')
    const modulos = app.findCollectionByNameOrId('modulos')

    // ---- partes (capítulos do livro) ----
    if (!app.hasTable('partes')) {
      const partes = new Collection({
        name: 'partes',
        type: 'base',
        // Mesma regra do curso: quem pode ver o curso vê as partes dele.
        listRule:
          '@request.auth.papel = "admin" || @request.auth.papel = "suporte" || curso.publicado = true',
        viewRule:
          '@request.auth.papel = "admin" || @request.auth.papel = "suporte" || curso.publicado = true',
        // Só a equipe cria/edita. É estrutura de conteúdo, não dado de aluno.
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'curso',
            type: 'relation',
            required: true,
            maxSelect: 1,
            collectionId: cursos.id,
            cascadeDelete: true,
          },
          { name: 'titulo', type: 'text', required: true, max: 160 },
          { name: 'slug', type: 'text', required: false, max: 120 },
          // Rótulo humano: "Capítulo 1", "Parte I". Separado de `ordem` porque
          // o rótulo é o que o aluno lê e a ordem é o que o sistema ordena.
          { name: 'rotulo', type: 'text', required: false, max: 40 },
          { name: 'resumo', type: 'text', required: false, max: 600 },
          { name: 'ordem', type: 'number', required: true, min: 0, onlyInt: true },
          { name: 'publicado', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_partes_curso ON partes (curso, ordem)',
          "CREATE UNIQUE INDEX idx_partes_slug ON partes (slug) WHERE slug != ''",
        ],
      })
      app.save(partes)
    }

    // ---- módulo ganha: parte, carga própria e o que certifica ----
    if (!modulos.fields.getByName('parte')) {
      modulos.fields.add(
        new RelationField({
          name: 'parte',
          required: false,
          maxSelect: 1,
          collectionId: app.findCollectionByNameOrId('partes').id,
          cascadeDelete: false,
        }),
      )
    }
    // Carga horária DO MÓDULO: soma no certificado do curso. Sem isto o
    // certificado teria uma carga total que ninguém sabe de onde veio.
    if (!modulos.fields.getByName('carga_horas')) {
      modulos.fields.add(new NumberField({ name: 'carga_horas', required: false, min: 0 }))
    }
    // O que este módulo certifica, em uma linha. Vira item na lista do
    // certificado — escrito pelo dono, não deduzido dos títulos das aulas.
    if (!modulos.fields.getByName('cert_conteudo')) {
      modulos.fields.add(new TextField({ name: 'cert_conteudo', required: false, max: 500 }))
    }
    app.save(modulos)

    // ---- curso ganha os dados de emissão do certificado ----
    const camposCert = [
      { name: 'cert_ativo', tipo: 'bool' },
      { name: 'cert_titulo', tipo: 'text', max: 200 },
      { name: 'cert_texto', tipo: 'text', max: 2000 },
      { name: 'cert_carga_horas', tipo: 'number' },
      { name: 'cert_assinante_nome', tipo: 'text', max: 160 },
      { name: 'cert_assinante_cargo', tipo: 'text', max: 160 },
      { name: 'cert_cidade', tipo: 'text', max: 120 },
    ]
    for (let i = 0; i < camposCert.length; i++) {
      const c = camposCert[i]
      if (cursos.fields.getByName(c.name)) continue
      if (c.tipo === 'bool') cursos.fields.add(new BoolField({ name: c.name }))
      else if (c.tipo === 'number')
        cursos.fields.add(new NumberField({ name: c.name, required: false, min: 0 }))
      else cursos.fields.add(new TextField({ name: c.name, required: false, max: c.max }))
    }
    app.save(cursos)

    // ---- código de verificação do certificado ----
    // Um certificado precisa poder ser CONFERIDO por terceiro; senão é um PDF
    // que qualquer um edita. Coleção própria, uma linha por emissão.
    if (!app.hasTable('certificados')) {
      const cert = new Collection({
        name: 'certificados',
        type: 'base',
        // O aluno vê os seus. A verificação pública é por endpoint (não
        // expõe lista: lista aberta deixaria vazar nome de todo mundo).
        listRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.papel = "admin")',
        viewRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.papel = "admin")',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            maxSelect: 1,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
          },
          {
            name: 'curso',
            type: 'relation',
            required: true,
            maxSelect: 1,
            collectionId: cursos.id,
            cascadeDelete: false,
          },
          // Código curto e legível para conferência manual (ex.: WMS-7K2F-9QX4).
          { name: 'codigo', type: 'text', required: true, max: 40 },
          // Cópia dos dados NO MOMENTO da emissão. Se o curso mudar depois, o
          // certificado antigo continua dizendo a verdade de quando foi emitido
          // — e não é reescrito pelo histórico.
          { name: 'nome_aluno', type: 'text', required: false, max: 200 },
          { name: 'titulo_curso', type: 'text', required: false, max: 200 },
          { name: 'carga_horas', type: 'number', required: false, min: 0 },
          { name: 'assinante_nome', type: 'text', required: false, max: 160 },
          { name: 'assinante_cargo', type: 'text', required: false, max: 160 },
          // Cópia do NOME do arquivo da rubrica no momento da emissão. A
          // imagem em si vive no curso; aqui só o ponteiro, porque certificado
          // não deve duplicar binário.
          { name: 'assinatura_arquivo', type: 'text', required: false, max: 200 },
          { name: 'emitido_em', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_certificados_codigo ON certificados (codigo)',
          'CREATE UNIQUE INDEX idx_certificados_user_curso ON certificados (user, curso)',
        ],
      })
      app.save(cert)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('certificados'))
    } catch (_) {}
    try {
      const modulos = app.findCollectionByNameOrId('modulos')
      ;['parte', 'carga_horas', 'cert_conteudo'].forEach((n) => {
        if (modulos.fields.getByName(n)) modulos.fields.removeByName(n)
      })
      app.save(modulos)
    } catch (_) {}
    try {
      const cursos = app.findCollectionByNameOrId('cursos')
      const nomes = [
        'cert_ativo',
        'cert_titulo',
        'cert_texto',
        'cert_carga_horas',
        'cert_assinante_nome',
        'cert_assinante_cargo',
        'cert_cidade',
      ]
      nomes.forEach((n) => {
        if (cursos.fields.getByName(n)) cursos.fields.removeByName(n)
      })
      app.save(cursos)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('partes'))
    } catch (_) {}
  },
)
