// 0047_rate_limit_rotas_proprias.js
//
// REVISÃO EXTERNA, item 11 — limite para ROTAS PRÓPRIAS (/backend/v1/...).
//
// POR QUE NÃO USEI O LIMITADOR NATIVO:
// `settings.rateLimits` funciona para rotas NATIVAS — testei e confirmei
// (10 logins passaram, a 11ª recebeu 429). Para rota PRÓPRIA, não: tentei o
// rótulo como `/caminho` (0045) e como `*:/caminho` (0046), e em ambos a rajada
// de 13 resgates de voucher passou inteira, sem 429. O PocketBase casa o
// limitador nativo com rotas registradas por ele, não com `routerAdd`.
//
// SOLUÇÃO: coleção própria de contagem. O handler da rota consulta e incrementa
// aqui. Vive no banco (não em memória) porque o backend reinicia a cada deploy
// e cada requisição roda em escopo isolado — memória não sobrevive.
//
// LIMPEZA: as linhas velhas são apagadas pelo próprio endpoint quando a janela
// expira. Não há cron novo: a coleção fica pequena porque só guarda a janela
// corrente (poucas dezenas de linhas).

migrate(
  (app) => {
    // ---- coleção de contagem ----
    let col = null
    try {
      col = app.findCollectionByNameOrId('limite_requisicoes')
    } catch (_) {}

    if (!col) {
      col = new Collection({
        name: 'limite_requisicoes',
        type: 'base',
        // FECHADA: só o servidor (endpoint) lê e escreve. Nenhum cliente acessa.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'chave', type: 'text', required: true, max: 160 },
          { name: 'contador', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'janela_inicio', type: 'date', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_limite_chave ON limite_requisicoes (chave)'],
      })
      app.save(col)
      console.log('[ead] coleção limite_requisicoes criada')
    } else {
      console.log('[ead] coleção limite_requisicoes já existe')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('limite_requisicoes')
      app.delete(col)
    } catch (_) {}
  },
)
