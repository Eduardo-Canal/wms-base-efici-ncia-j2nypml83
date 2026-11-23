// portao-listagem.pb.js — quem pode LER cada coleção do EAD.
//
// ── REGRA ATUAL (cenário aprovado 20/11, opção ii) ────────────────────────
//
// VITRINE (`cursos`, `produtos`, `modulos`, `partes`):
//   * com `ead_config.liberado = true` → QUALQUER UM lê. É a vitrine: título,
//     resumo, módulos, preço. Sem isso o visitante não vê nem o que está à venda.
//   * com `liberado = false` → só equipe e quem tem matrícula ativa.
//
// AULAS (`aulas`): NUNCA aberta ao visitante — nem com `liberado = true`.
//   Motivo: regra de linha não tem granularidade de campo. Se a linha é
//   visível, o TÍTULO da aula paga vai junto, e neste curso o título é o
//   produto vendido ("Aula 10: Buscando a máxima performance: ERP x WMS").
//   Entregar a lista completa de graça esvazia a compra.
//
//   Quem mostra a lista de aulas é /backend/v1/ead/curso/{slug}
//   (vitrine-curso.pb.js), que monta a resposta CAMPO A CAMPO: aula isca sai com
//   slug e título; aula paga sai só com número e duração (o cadeado).
//
// ── AULA ISCA (amostra) ───────────────────────────────────────────────────
// O vídeo da isca NÃO passa por aqui: sai por
// /backend/v1/aulas/{slug}/playback-publico, que valida `amostra` e `publicado`
// e devolve a URL assinada do Bunny. Coleção fechada, isca aberta — de
// propósito: a coleção é lista, a isca é entrega.
//
// ── POR QUE AQUI E NÃO NA listRule ────────────────────────────────────────
// Regra de linha só enxerga a própria linha: não existe "só se
// ead_config.liberado = true" numa regra de `cursos`, porque a regra não faz
// join em outra coleção. Como a regra não alcança, o hook RECUSA a requisição.
//
// ── ATENÇÃO AO ESCOPO ─────────────────────────────────────────────────────
// Cada handler do JSVM roda em escopo isolado: função declarada no topo do
// arquivo NÃO é visível dentro do callback (dá ReferenceError e a listagem
// quebra para todo mundo — bug real, 23:19). Por isso a checagem é INLINE em
// cada handler, repetida de propósito.
//
// ── MATERIAL (PDF) ────────────────────────────────────────────────────────
// Continua escondido de quem não tem matrícula por aula-material-oculto.pb.js
// (onRecordEnrich). Defesa em profundidade: mesmo que alguém leia a aula, o
// link do PDF não vai junto.

// ===========================================================================
// VITRINE — depende de `liberado`, com equipe/matrícula sempre passando
// ===========================================================================

onRecordsListRequest((e) => {
  let aberto = false
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    aberto = cfg.getBool('liberado') === true
  } catch (_) {
    aberto = false // na dúvida, fechado
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
}, 'partes')

// ===========================================================================
// AULAS — NUNCA pública. Só equipe ou matrícula ativa.
// (Dois handlers: list e view. Sem o view, quem soubesse o id leria o registro.)
// ===========================================================================

onRecordsListRequest((e) => {
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
  } catch (_) {}
  if (liberado) return e.next()
  throw new ForbiddenError('A lista de aulas é do aluno matriculado.')
}, 'aulas')

onRecordViewRequest((e) => {
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
  } catch (_) {}
  if (liberado) return e.next()
  throw new ForbiddenError('A aula é do aluno matriculado.')
}, 'aulas')

// ===========================================================================
// VISUALIZAÇÃO POR ID DA VITRINE — sem isto, quem souber o id lê o registro
// mesmo com a listagem fechada.
// ===========================================================================

onRecordViewRequest((e) => {
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
}, 'cursos')

onRecordViewRequest((e) => {
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

onRecordViewRequest((e) => {
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

onRecordViewRequest((e) => {
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
}, 'partes')
