// versao.pb.js — GET /backend/v1/versao  (restrito a admin/superusuário)
//
// REVISÃO EXTERNA, item 3 (18/11): o dono pediu duas correções.
//
// 1. EXIGIR ADMIN OU SUPERUSUÁRIO. Antes era público. Informação de versão não
//    é segredo, mas também não é assunto de aluno e ajuda quem procura
//    diferença entre versões — e, com o repo público, cruzar ref com código é
//    trivial. Passa a exigir papel de equipe.
//
// 2. REMOVER `versao` E `ref_lote` FIXOS. Eles estavam escritos à mão no código,
//    então mentiam no primeiro deploy seguinte (ficaram "0.0.128" quando o
//    projeto já estava em 0.0.143). Número de versão escrito no código é sempre
//    uma cópia que atrasa.
//
// DE ONDE VEM A VERSÃO AGORA — de dado que o próprio deploy escreve:
//   1. `_migrations`: a última aplicada (prova que o schema está neste ponto);
//   2. contagem de migrations aplicadas;
//   3. marca de tempo do servidor (detecta resposta em cache).
//
// ATENÇÃO AO ESCOPO: cada handler do JSVM roda isolado; nada de helper no topo.

routerAdd('GET', '/backend/v1/versao', (e) => {
  // ---- autorização ----
  const auth = e.requestInfo().auth
  if (!auth)
    return e.json(401, {
      codigo: 'precisa_login',
      mensagem: 'Entre com uma conta de administrador.',
    })

  let equipe = false
  try {
    if (auth.collection().name === '_superusers') equipe = true
    else {
      const p = String(auth.get('papel'))
      equipe = p === 'admin' || p === 'suporte'
    }
  } catch (_) {}
  if (!equipe)
    return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só a equipe vê esta informação.' })

  // ---- dados que vêm do banco, não do código ----
  let ultima = ''
  let total = 0
  try {
    const migs = $app.findRecordsByFilter('_migrations', "id != ''", '-applied', 500, 0)
    total = migs.length
    if (migs.length) {
      ultima = String(migs[0].getString('file') || migs[0].getString('name') || '')
    }
  } catch (err) {
    console.log('[ead][versao] falha ao ler _migrations: ' + err.message)
  }

  return e.json(200, {
    ultima_migration: ultima,
    total_migrations: total,
    servidor: new Date().toISOString(),
    hook_versao_ativo: true,
  })
})
