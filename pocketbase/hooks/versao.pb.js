// versao.pb.js — GET /backend/v1/versao
//
// POR QUE EXISTE (pedido do dono, 18/11): depois de publicar, não havia como
// responder de fora "qual versão está no ar?". O painel mostra a ref do projeto,
// mas o que o aluno recebe é o build publicado — e já aconteceu de os dois
// divergirem (o hook novo não subiu depois de três publicações). Este endpoint
// responde a versão PÚBLICA, lida do arquivo `pocketbase/versao.json`, que é
// versionado junto com o código: se o arquivo está na versão X, o deploy que
// serve este endpoint é o X.
//
// Sem autenticação: é informação de operação, não de aluno. Não expõe segredo,
// caminho nem dado de ninguém — só número de versão e data.
//
// ATENÇÃO AO ESCOPO: cada handler do JSVM roda isolado; nada de helper no topo.

routerAdd('GET', '/backend/v1/versao', (e) => {
  // Lê o arquivo do próprio projeto. O filesystem do PocketBase é montado no
  // diretório do projeto (pb_data/.. no runtime do Skip), então tentamos os
  // caminhos relativos usuais e devolvemos o que existir.
  var bruto = ''

  function tentar(caminho) {
    try {
      var fs = $app.newFilesystem()
      var f = fs.get(caminho)
      if (f && f.size() > 0) {
        var b = f.read(0, f.size())
        if (b && b.length) {
          var s = ''
          for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
          return s
        }
      }
    } catch (_) {}
    return ''
  }

  // Caminhos candidatos: o deploy coloca o projeto em lugares diferentes
  // conforme o ambiente (preview/produção).
  var candidatos = [
    'pocketbase/versao.json',
    './pocketbase/versao.json',
    'versao.json',
    '../pocketbase/versao.json',
  ]
  for (var i = 0; i < candidatos.length; i++) {
    bruto = tentar(candidatos[i])
    if (bruto) break
  }

  if (!bruto) {
    // Arquivo não encontrado: devolve o que o próprio código sabe.
    return e.json(200, {
      versao: 'desconhecida',
      ref: 'desconhecida',
      fonte: 'arquivo versao.json nao legivel neste ambiente',
      servidor: new Date().toISOString(),
    })
  }

  var dados = {}
  try {
    dados = JSON.parse(bruto)
  } catch (_) {
    return e.json(200, {
      versao: 'desconhecida',
      ref: 'desconhecida',
      fonte: 'versao.json ilegivel',
      servidor: new Date().toISOString(),
    })
  }

  return e.json(200, {
    versao: dados.versao || '',
    ref: dados.ref || '',
    atualizado_em: dados.atualizado_em || '',
    lote: dados.lote || '',
    // Quando ESTE servidor respondeu — permite detectar resposta em cache.
    servidor: new Date().toISOString(),
  })
})
