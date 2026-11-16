// 0032_vouchers.js
//
// VOUCHERS — acesso pago, promocional ou livre (funcionários da Zion, prospecção).
//
// O QUE É: um código curto que o dono gera no painel e o aluno digita em
// /ead/voucher. O sistema resgata na hora, cria a matrícula e libera a aula.
// Sem pagamento, sem espera, sem intervenção manual no meio.
//
// TRÊS TIPOS, e por que os três existem:
//   - `promocional` — desconto (percentual ou valor). NÃO libera sozinho: o
//     aluno usa o código na compra e paga o valor com desconto.
//   - `acesso`      — libera o curso de graça, uma vez, para uma pessoa.
//     É o caso "funcionário da Zion" e o caso "prospecção".
//   - `livre`       — libera para qualquer um que tenha o código, N vezes.
//     Serve para uma campanha (ex.: aula aberta por 30 dias).
//
// REGRAS DE SEGURANÇA que estão no DESENHO, não só na tela:
//   * Código é único e gerado pelo servidor; adivinhar não é viável.
//   * Cada voucher tem limite de usos e validade; resgate além do limite falha.
//   * O resgate cria UMA matrícula por usuário/curso (índice único garante).
//   * Voucher de `acesso` pode ser preso a um e-mail específico — assim um
//     código vazado não vira curso grátis para estranhos.
//   * Quem resgata precisa estar logado: sem conta não há a quem matricular.
//
// NÃO EXISTE VOUCHER QUE DÊ ADMIN. Voucher só cria matrícula de curso.

migrate(
  (app) => {
    const admin = '@request.auth.papel = "admin"'

    // ---- vouchers ----
    if (!app.hasTable('vouchers')) {
      const vouchers = new Collection({
        name: 'vouchers',
        type: 'base',
        // O ALUNO precisa LER o voucher para resgatar (o resgate é endpoint,
        // mas a tela mostra o que ele é antes de confirmar). Ele não lista
        // todos: quem lista é só admin. Por isso a listRule é fechada e o
        // resgate acontece por endpoint próprio.
        listRule: admin,
        viewRule: admin,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          // Código que o aluno digita. Único, maiúsculo, sem espaço.
          { name: 'codigo', type: 'text', required: true, min: 4, max: 32 },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            // `percentual` e `valor` são desconto; `acesso` e `livre` liberam.
            values: ['percentual', 'valor', 'acesso', 'livre'],
          },
          // Para onde o voucher vale. Vazio em `livre` = vale para todos os cursos.
          {
            name: 'cursos',
            type: 'relation',
            required: false,
            maxSelect: 20,
            collectionId: app.findCollectionByNameOrId('cursos').id,
            cascadeDelete: false,
          },
          // Desconto: percentual (1-100) ou centavos.
          { name: 'percentual', type: 'number', required: false, min: 0, max: 100, onlyInt: true },
          { name: 'valor_centavos', type: 'number', required: false, min: 0, onlyInt: true },
          // Teto de usos. 0 = sem limite (só faz sentido em `livre`).
          { name: 'limite_usos', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'usos', type: 'number', required: false, min: 0, onlyInt: true },
          // Validade. Data vazia = não expira.
          { name: 'validade', type: 'date', required: false },
          // Prende o voucher a um e-mail (concessão individual: funcionário,
          // convite). Vazio = qualquer pessoa com o código.
          { name: 'email_destino', type: 'text', required: false, max: 160 },
          { name: 'descricao', type: 'text', required: false, max: 200 },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_vouchers_codigo ON vouchers (codigo)',
          'CREATE INDEX idx_vouchers_ativo ON vouchers (ativo, tipo)',
        ],
      })
      app.save(vouchers)
    }

    // ---- resgates ----
    // Uma linha por resgate: auditoria de quem usou o quê e quando.
    // Sem isso não dá para responder "quantos usaram o cupom da campanha?"
    if (!app.hasTable('voucher_resgates')) {
      const resgates = new Collection({
        name: 'voucher_resgates',
        type: 'base',
        listRule: '@request.auth.id != "" && (user = @request.auth.id || ' + admin + ')',
        viewRule: '@request.auth.id != "" && (user = @request.auth.id || ' + admin + ')',
        // Só o servidor cria resgate (endpoint). Cliente não inventa resgate.
        createRule: null,
        updateRule: null,
        deleteRule: admin,
        fields: [
          {
            name: 'voucher',
            type: 'relation',
            required: true,
            maxSelect: 1,
            collectionId: app.findCollectionByNameOrId('vouchers').id,
            cascadeDelete: false,
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            maxSelect: 1,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
          },
          {
            name: 'curso',
            type: 'relation',
            required: false,
            maxSelect: 1,
            collectionId: app.findCollectionByNameOrId('cursos').id,
            cascadeDelete: false,
          },
          { name: 'email', type: 'text', required: false, max: 160 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          // A MESMA pessoa não resgata o MESMO voucher duas vezes.
          'CREATE UNIQUE INDEX idx_resgate_voucher_user ON voucher_resgates (voucher, user)',
          'CREATE INDEX idx_resgate_voucher ON voucher_resgates (voucher)',
        ],
      })
      app.save(resgates)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('voucher_resgates'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('vouchers'))
    } catch (_) {}
  },
)
