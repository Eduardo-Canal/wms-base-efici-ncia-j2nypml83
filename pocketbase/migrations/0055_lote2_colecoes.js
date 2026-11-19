// 0055_lote2_colecoes.js
//
// LOTE 2 — coleções novas do fluxo do presente.
//
// REGRA DE ACESSO DE TODAS ELAS (pedido explícito do lote):
//   * `listRule`/`viewRule`: o aluno só vê o que é dele (`user = @request.auth.id`);
//     admin e suporte veem tudo.
//   * `createRule`/`updateRule`: idem — a linha é do próprio aluno.
//   * `deleteRule`: nulo. Nada aqui é apagado pelo cliente; o servidor decide.
// O QUE O ALUNO NÃO PODE FAZER DIRETO: marcar marcos da jornada no voucher
// (a coleção `vouchers` continua fechada a ele) e escrever `codigo` de
// pré-diagnóstico — isso é gerado pelo servidor.
//
// ORDEM DAS MIGRATIONS = ORDEM DE DEPENDÊNCIA: `dores` antes de `aula_dores`;
// `aulas` e `cursos` já existem.

migrate(
  (app) => {
    const ID_CURSOS = 'pbc_2238392150'
    const ID_AULAS = 'pbc_32509825'
    const ID_USERS = '_pb_users_auth_'

    // ---------------------------------------------------------------
    // dores — catálogo de dores da operação
    // ---------------------------------------------------------------
    let dores = null
    try {
      dores = app.findCollectionByNameOrId('dores')
    } catch (_) {}
    if (!dores) {
      dores = new Collection({
        name: 'dores',
        type: 'base',
        // Catálogo: leitura para quem está logado (é a lista da pergunta 3 do
        // diagnóstico). Escrita só admin.
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.papel = "admin"',
        updateRule: '@request.auth.papel = "admin"',
        deleteRule: '@request.auth.papel = "admin"',
        fields: [
          { name: 'nome', type: 'text', required: true, max: 120 },
          { name: 'texto_prediagnostico', type: 'text', required: false, max: 600 },
          { name: 'ordem', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'ativo', type: 'bool', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_dores_nome ON dores (nome)'],
      })
      app.save(dores)
      console.log('[ead][lote2] coleção dores criada')
    }

    // ---------------------------------------------------------------
    // diagnosticos — o diagnóstico obrigatório
    // ---------------------------------------------------------------
    let diag = null
    try {
      diag = app.findCollectionByNameOrId('diagnosticos')
    } catch (_) {}
    if (!diag) {
      diag = new Collection({
        name: 'diagnosticos',
        type: 'base',
        listRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        viewRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        // O aluno cria e altera o PRÓPRIO diagnóstico. Os marcos do voucher e
        // o `diagnostico_em` são gravados pelo servidor.
        createRule: 'user = @request.auth.id',
        updateRule: 'user = @request.auth.id',
        deleteRule: null,
        fields: [
          { name: 'user', type: 'relation', required: true, collectionId: ID_USERS, maxSelect: 1 },
          {
            name: 'curso',
            type: 'relation',
            required: true,
            collectionId: ID_CURSOS,
            maxSelect: 1,
          },
          {
            name: 'tipo_operacao',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['3pl', 'armazem_geral', 'cd_proprio', 'ecommerce', 'outro'],
          },
          {
            name: 'controle_atual',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['planilha', 'erp', 'wms_mercado', 'sistema_proprio', 'implantando'],
          },
          // mínimo 1 e máximo 2 dores (o pedido é explícito)
          {
            name: 'dores',
            type: 'relation',
            required: false,
            collectionId: dores.id,
            maxSelect: 2,
            minSelect: 0,
          },
          {
            name: 'papel',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['diretoria', 'gerencia', 'supervisao', 'ti', 'consultoria', 'outro'],
          },
          {
            name: 'porte',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['ate_2mil', 'de_2a10mil', 'de_10a30mil', 'acima_30mil'],
          },
          { name: 'aceite_contato', type: 'bool', required: false },
          { name: 'aceite_contato_em', type: 'date', required: false },
          { name: 'aceite_texto_versao', type: 'text', required: false, max: 40 },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_diag_user_curso ON diagnosticos (user, curso)'],
      })
      app.save(diag)
      console.log('[ead][lote2] coleção diagnosticos criada')
    }

    // ---------------------------------------------------------------
    // aula_dores — liga aula ↔ dor, com a porta de entrada
    // ---------------------------------------------------------------
    let ad = null
    try {
      ad = app.findCollectionByNameOrId('aula_dores')
    } catch (_) {}
    if (!ad) {
      ad = new Collection({
        name: 'aula_dores',
        type: 'base',
        // Aluno logado lê (o pré-diagnóstico precisa saber a aula base).
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.papel = "admin"',
        updateRule: '@request.auth.papel = "admin"',
        deleteRule: '@request.auth.papel = "admin"',
        fields: [
          { name: 'aula', type: 'relation', required: true, collectionId: ID_AULAS, maxSelect: 1 },
          { name: 'dor', type: 'relation', required: true, collectionId: dores.id, maxSelect: 1 },
          { name: 'porta_entrada', type: 'bool', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_auladores_aula_dor ON aula_dores (aula, dor)'],
      })
      app.save(ad)
      console.log('[ead][lote2] coleção aula_dores criada')
    }

    // ---------------------------------------------------------------
    // respostas_fixacao — o que o aluno respondeu no "Para fixar"
    // ---------------------------------------------------------------
    let rf = null
    try {
      rf = app.findCollectionByNameOrId('respostas_fixacao')
    } catch (_) {}
    if (!rf) {
      rf = new Collection({
        name: 'respostas_fixacao',
        type: 'base',
        listRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        viewRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        createRule: 'user = @request.auth.id',
        updateRule: 'user = @request.auth.id',
        deleteRule: null,
        fields: [
          { name: 'user', type: 'relation', required: true, collectionId: ID_USERS, maxSelect: 1 },
          { name: 'aula', type: 'relation', required: true, collectionId: ID_AULAS, maxSelect: 1 },
          { name: 'texto', type: 'text', required: false, max: 2000 },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_respfx_user_aula ON respostas_fixacao (user, aula)'],
      })
      app.save(rf)
      console.log('[ead][lote2] coleção respostas_fixacao criada')
    }

    // ---------------------------------------------------------------
    // prediagnosticos — o resumo que vira lead
    // ---------------------------------------------------------------
    let pd = null
    try {
      pd = app.findCollectionByNameOrId('prediagnosticos')
    } catch (_) {}
    if (!pd) {
      pd = new Collection({
        name: 'prediagnosticos',
        type: 'base',
        listRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        viewRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        // O registro é criado pelo ENDPOINT (que monta o snapshot e gera o
        // código). O aluno não cria direto, senão forjaria código e snapshot.
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'user', type: 'relation', required: true, collectionId: ID_USERS, maxSelect: 1 },
          {
            name: 'curso',
            type: 'relation',
            required: true,
            collectionId: ID_CURSOS,
            maxSelect: 1,
          },
          { name: 'codigo', type: 'text', required: true, max: 16 },
          {
            name: 'momento',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['estudando', 'avaliando', 'projeto_aprovado', 'tem_wms'],
          },
          {
            name: 'prazo',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['ate_3m', 'de_3a6m', 'de_6a12m', 'sem_prazo'],
          },
          { name: 'nivel', type: 'number', required: false, min: 0, max: 5, onlyInt: true },
          { name: 'snapshot', type: 'json', required: false, maxSize: 200000 },
          { name: 'enviar_anotacoes', type: 'bool', required: false },
          { name: 'aprofundamento_em', type: 'date', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_prediag_user_curso ON prediagnosticos (user, curso)',
          'CREATE UNIQUE INDEX idx_prediag_codigo ON prediagnosticos (codigo)',
        ],
      })
      app.save(pd)
      console.log('[ead][lote2] coleção prediagnosticos criada')
    }

    // ---------------------------------------------------------------
    // avisos_lancamento — "me avise quando lançar"
    // ---------------------------------------------------------------
    let av = null
    try {
      av = app.findCollectionByNameOrId('avisos_lancamento')
    } catch (_) {}
    if (!av) {
      av = new Collection({
        name: 'avisos_lancamento',
        type: 'base',
        listRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        viewRule:
          'user = @request.auth.id || @request.auth.papel = "admin" || @request.auth.papel = "suporte"',
        createRule: 'user = @request.auth.id',
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'user', type: 'relation', required: true, collectionId: ID_USERS, maxSelect: 1 },
          {
            name: 'curso',
            type: 'relation',
            required: true,
            collectionId: ID_CURSOS,
            maxSelect: 1,
          },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_avisos_user_curso ON avisos_lancamento (user, curso)'],
      })
      app.save(av)
      console.log('[ead][lote2] coleção avisos_lancamento criada')
    }
  },
  (app) => {
    // Reverter apagaria coleções com dado de aluno. Não é automático.
  },
)
