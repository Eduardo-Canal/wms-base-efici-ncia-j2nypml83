// TESTE TEMPORARIO — probe de colisao de campo e de marcacao de migration.
// Apagado em seguida. Nao cria colecao, so tenta gravar um campo em `users`
// e devolve o erro, para eu saber se `nome` colide com `name`.
routerAdd('GET', '/backend/v1/probe-campo', (e) => {
  const out = { passo: '', erro: '', campos: [] }
  try {
    const users = $app.findCollectionByNameOrId('users')
    const nomes = []
    for (let i = 0; i < users.fields.length; i++) nomes.push(users.fields[i].name)
    out.campos = nomes
    out.passo = 'leu-colecao'
  } catch (err) {
    out.erro = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
