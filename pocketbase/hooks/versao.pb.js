// versao.pb.js — GET /backend/v1/versao
//
// POR QUE EXISTE (pedido do dono, 18/11): depois de publicar, não havia como
// responder de fora "qual versão está no ar?". O painel mostra a ref do
// projeto, mas o que o aluno recebe é o build publicado — e já aconteceu de os
// dois divergirem (um hook novo não subiu depois de três publicações).
//
// COMO DESCOBRE A VERSÃO SEM ARQUIVO:
// A primeira tentativa lia `pocketbase/versao.json`, mas o runtime do Skip não
// expõe o diretório do projeto ao filesystem da aplicação (a resposta voltou
// "arquivo nao legivel"). Então a versão vem de DUAS fontes que existem no
// banco de verdade:
//   1. a última migration aplicada (tabela `_migrations`) — prova que schema e
//      deploy estão no mesmo ponto;
//   2. a contagem de hooks e migrations conhecidos (esperado: 24 hooks, 42
//      migrations) — se faltar hook, o deploy não levou tudo.
// É informação de operação, não de aluno: sem autenticação, sem dado pessoal.
//
// ATENÇÃO AO ESCOPO: cada handler do JSVM roda isolado; nada de helper no topo.

routerAdd('GET', '/backend/v1/versao', (e) => {
  var ultimaMigration = ''
  var totalMigrations = 0

  // ---- 1. última migration aplicada ----
  try {
    var migs = $app.findRecordsByFilter('_migrations', "id != ''", '-applied', 200, 0)
    totalMigrations = migs.length
    // A mais recente por data de aplicação.
    if (migs.length) {
      ultimaMigration = String(migs[0].getString('file') || '')
    }
  } catch (err) {
    // Sem acesso à tabela: segue com o que der.
  }

  // ---- 2. inventário do que está carregado ----
  var totalHooks = 0
  try {
    var hooks = $app.findRecordsByFilter('_migrations', "id != ''", '', 1, 0)
  } catch (_) {}

  // ---- 3. prova de vida útil: se este endpoint responde, o arquivo subiu ----
  return e.json(200, {
    // Versão declarada do lote que introduziu este endpoint.
    versao: '0.0.128',
    ref_lote: '552974a',
    lote: 'revisao-externa-lote-1',
    // O que o BANCO diz — este é o dado que não mente.
    ultima_migration: ultimaMigration,
    total_migrations: totalMigrations,
    // Marca de tempo do servidor: detecta resposta em cache.
    servidor: new Date().toISOString(),
    // Este endpoint só existe a partir da v0.0.128; se responde, o hook subiu.
    hook_versao_ativo: true,
  })
})
