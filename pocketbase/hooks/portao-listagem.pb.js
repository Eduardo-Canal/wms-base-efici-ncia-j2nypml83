// portao-listagem.pb.js — fecha o CATÁLOGO para o visitante quando a área está fechada.
//
// DEFEITO QUE ESTE ARQUIVO CORRIGE (encontrado no navegador, 15/11 20h30):
// os hooks de playback/material/admin barraram vídeo, PDF e painel, mas o
// visitante continuava VENDO o catálogo em /ead — porque `cursos`, `produtos` e
// `modulos` têm listRule pública própria. Portão que só cobre endpoint não é
// portão: a vitrine fica exposta antes da hora de liberar.
//
// POR QUE AQUI E NÃO NA listRule:
// regra de linha só enxerga a própria linha — não dá para escrever "só se
// ead_config.liberado = true" numa regra de `cursos`, porque nesse formato a
// regra não faz join em outra coleção. E o guia do Skip é explícito: esconder
// linha pertence à listRule, não ao hook. Como a regra não alcança, o hook
// RECUSA a requisição.
//
// 403 é honesto: a vitrine não é um rascunho "invisível", ela não existe para
// quem não é da equipe. A tela trata isso mostrando "área em preparação".
//
// ATENÇÃO AO ESCOPO (bug real, provado no log às 23:19):
// cada handler do JSVM roda em escopo isolado. Função declarada no topo do
// arquivo NÃO é visível dentro do callback — dá `ReferenceError: areaAberta is
// not defined`, o PocketBase devolve 400 genérico e a listagem quebra para
// TODO MUNDO, inclusive para o admin. Por isso a checagem é INLINE em cada
// handler, repetida de propósito.
//
// LIMITE DECLARADO: isto protege estas três listagens. Coleção nova com listRule
// pública e exibida no /ead precisa do mesmo tratamento — não há herança.

onRecordsListRequest((e) => {
  // PORTÃO (inline — ver aviso de escopo no topo)
  let aberto = false
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    aberto = cfg.getBool('liberado') === true
  } catch (_) {
    aberto = false // na dúvida, fechado
  }

  if (aberto) return e.next()

  let equipe = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const papel = String(auth.get('papel'))
        equipe = papel === 'admin' || papel === 'suporte'
      }
    }
  } catch (_) {
    equipe = false
  }

  if (equipe) return e.next()
  throw new ForbiddenError('A área de cursos ainda não está aberta.')
}, 'cursos')

onRecordsListRequest((e) => {
  let aberto = false
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    aberto = cfg.getBool('liberado') === true
  } catch (_) {
    aberto = false
  }

  if (aberto) return e.next()

  let equipe = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const papel = String(auth.get('papel'))
        equipe = papel === 'admin' || papel === 'suporte'
      }
    }
  } catch (_) {
    equipe = false
  }

  if (equipe) return e.next()
  throw new ForbiddenError('A área de cursos ainda não está aberta.')
}, 'produtos')

onRecordsListRequest((e) => {
  let aberto = false
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    aberto = cfg.getBool('liberado') === true
  } catch (_) {
    aberto = false
  }

  if (aberto) return e.next()

  let equipe = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const papel = String(auth.get('papel'))
        equipe = papel === 'admin' || papel === 'suporte'
      }
    }
  } catch (_) {
    equipe = false
  }

  if (equipe) return e.next()
  throw new ForbiddenError('A área de cursos ainda não está aberta.')
}, 'modulos')
