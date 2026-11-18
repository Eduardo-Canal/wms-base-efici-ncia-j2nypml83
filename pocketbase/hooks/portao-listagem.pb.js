// portao-listagem.pb.js — fecha o CATÁLOGO para o visitante quando a área não
// está liberada, SEM trancar fora quem já pagou.
//
// ── REGRA DO PORTÃO (revisão externa, item 12) ────────────────────────────
// Com a área FECHADA (ead_config.liberado = false):
//   1. equipe (admin/suporte) e superusuário passam;
//   2. quem tem MATRÍCULA ATIVA passa — pagou ou recebeu cortesia;
//   3. visitante e conta sem matrícula não veem nada.
// Fora da equipe, o que se vê é o conteúdo. Não existe "catálogo aberto com
// área fechada": o portão controla a vitrine, não esconde o curso de quem
// comprou.
//
// ── O QUE ESTE ARQUIVO COBRE HOJE ─────────────────────────────────────────
// Listagem (list): `cursos`, `produtos`, `modulos`, `aulas`, `partes`.
//   * `aulas` e `partes` foram acrescentadas na revisão externa (item 12): o
//     portão cobria só as três primeiras, e a listagem de aulas ficava aberta
//     ao visitante — o que expõe título e estrutura do curso antes da abertura.
// Visualização por id (view): as mesmas cinco. Sem isso, quem soubesse o id de
// uma aula lia o registro mesmo com a listagem fechada.
//
// ── MATERIAL (material / material_url) ────────────────────────────────────
// Escondido de quem não tem matrícula em `aulas` (onRecordEnrich). A regra de
// linha não tem granularidade de campo: se a linha é visível, todos os campos
// vão junto. O PDF é conteúdo pago — o link só sai pelo endpoint /material,
// que confere matrícula.
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

// ---------------------------------------------------------------------------
// LISTAGEM
// ---------------------------------------------------------------------------
onRecordsListRequest((e) => {
  // PORTÃO (inline — ver nota de escopo no topo)
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

// NOVO (item 12): aulas também fecha ao visitante com a área fechada.
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
}, 'aulas')

// NOVO (item 12): capítulos (partes) também.
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

// ---------------------------------------------------------------------------
// VISUALIZAÇÃO POR ID — sem isto, quem souber o id lê o registro mesmo com a
// listagem fechada.
// ---------------------------------------------------------------------------
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
}, 'aulas')

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
