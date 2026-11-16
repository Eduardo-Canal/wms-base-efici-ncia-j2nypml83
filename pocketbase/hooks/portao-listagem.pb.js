// portao-listagem.pb.js — fecha o CATÁLOGO para o visitante quando a área não
// está liberada, SEM trancar fora quem já pagou.
//
// DEFEITO QUE ESTE ARQUIVO CORRIGE (navegador, 15/11 20h30):
// os hooks de playback/material/admin barraram vídeo, PDF e painel, mas o
// visitante continuava VENDO o catálogo em /ead — porque `cursos`, `produtos` e
// `modulos` têm listRule pública própria. Portão que só cobre endpoint não é
// portão: a vitrine fica exposta antes da hora.
//
// DEFEITO CORRIGIDO AGORA (16/11, antes do teste de pagamento):
// o portão barrava TODO MUNDO que não fosse da equipe. Consequência real: o
// aluno paga, a matrícula é criada, ele clica no link do e-mail e leva
// "A área de cursos ainda não está aberta" — pagou e não entra. O portão existe
// para controlar a VITRINE (venda e catálogo), nunca para tirar o acesso de
// quem já comprou. Agora quem tem matrícula ativa passa sempre.
//
// POR QUE AQUI E NÃO NA listRule:
// regra de linha só enxerga a própria linha — não dá para escrever "só se
// ead_config.liberado = true" numa regra de `cursos`, porque a regra não faz
// join em outra coleção. Como a regra não alcança, o hook RECUSA a requisição.
//
// ATENÇÃO AO ESCOPO (bug real, provado no log às 23:19):
// cada handler do JSVM roda em escopo isolado. Função declarada no topo do
// arquivo NÃO é visível dentro do callback — dá `ReferenceError` e a listagem
// quebra para todo mundo. Por isso a checagem é INLINE em cada handler,
// repetida de propósito.
//
// LIMITE DECLARADO: protege estas três listagens (`cursos`, `produtos`,
// `modulos`). Coleção nova com listRule pública exibida no /ead precisa do
// mesmo tratamento — não há herança.

onRecordsListRequest((e) => {
  // PORTÃO (inline)
  let aberto = false
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    aberto = cfg.getBool('liberado') === true
  } catch (_) {
    aberto = false // na dúvida, fechado
  }
  if (aberto) return e.next()

  // Área fechada: passa a equipe e quem já tem matrícula ativa.
  let liberado = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') liberado = true
      else {
        const papel = String(auth.get('papel'))
        if (papel === 'admin' || papel === 'suporte') liberado = true
        else {
          // Matrícula ativa = já pagou (ou recebeu cortesia). Não pode ser
          // barrado pelo interruptor da vitrine.
          const ms = $app.findRecordsByFilter(
            'matriculas',
            "user = {:u} && status = 'ativa'",
            '',
            1,
            0,
            { u: auth.id },
          )
          if (ms && ms.length) liberado = true
        }
      }
    }
  } catch (_) {
    liberado = false
  }
  if (liberado) return e.next()

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

  let liberado = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') liberado = true
      else {
        const papel = String(auth.get('papel'))
        if (papel === 'admin' || papel === 'suporte') liberado = true
        else {
          const ms = $app.findRecordsByFilter(
            'matriculas',
            "user = {:u} && status = 'ativa'",
            '',
            1,
            0,
            { u: auth.id },
          )
          if (ms && ms.length) liberado = true
        }
      }
    }
  } catch (_) {
    liberado = false
  }
  if (liberado) return e.next()

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

  let liberado = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') liberado = true
      else {
        const papel = String(auth.get('papel'))
        if (papel === 'admin' || papel === 'suporte') liberado = true
        else {
          const ms = $app.findRecordsByFilter(
            'matriculas',
            "user = {:u} && status = 'ativa'",
            '',
            1,
            0,
            { u: auth.id },
          )
          if (ms && ms.length) liberado = true
        }
      }
    }
  } catch (_) {
    liberado = false
  }
  if (liberado) return e.next()

  throw new ForbiddenError('A área de cursos ainda não está aberta.')
}, 'modulos')
