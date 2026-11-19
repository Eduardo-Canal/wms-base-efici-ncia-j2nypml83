// ead-resposta-fixacao.pb.js — POST /backend/v1/ead/resposta-fixacao
//
// LOTE 2, item 5: o aluno responde o "Para fixar" de cada aula.
//
// GRAVAÇÃO POR UPSERT: a resposta é do par (aluno, aula). Responder de novo
// ATUALIZA — não cria segunda linha e não dá erro. O índice único (user, aula)
// no banco garante isso mesmo sob requisições simultâneas.
//
// POR QUE NÃO É PELA API DIRETA DA COLEÇÃO: a coleção tem createRule/updateRule
// para o próprio aluno, então a tela PODERIA escrever direto. A rota existe
// porque o upsert por HTTP cru exige o cliente saber se já existe (GET + POST ou
// PATCH), e isso vira duas requisições e uma corrida. Aqui o servidor resolve.
//
// LIMITE DE TAMANHO: 2000 caracteres, igual ao campo. Cortar no servidor é
// melhor que o PocketBase recusar a gravação inteira.

routerAdd(
  'POST',
  '/backend/v1/ead/resposta-fixacao',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const aulaSlug = texto(corpo.aula)
    if (!aulaSlug) return e.json(400, { codigo: 'aula_obrigatoria', mensagem: 'Informe a aula.' })

    let aula = null
    try {
      aula = $app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: aulaSlug })
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

    // Precisa de matrícula no curso da aula: responder "Para fixar" de aula que
    // não tem é escrita de dado de aluno em curso alheio.
    let cursoId = ''
    try {
      const mod = $app.findRecordById('modulos', aula.getString('modulo'))
      cursoId = mod.getString('curso')
    } catch (_) {}
    let temMatricula = false
    if (cursoId) {
      try {
        const ms = $app.findRecordsByFilter(
          'matriculas',
          "user = {:u} && curso = {:c} && status = 'ativa'",
          '',
          1,
          0,
          { u: auth.id, c: cursoId },
        )
        temMatricula = !!(ms && ms.length)
      } catch (_) {}
    }
    if (!temMatricula)
      return e.json(403, {
        codigo: 'sem_matricula',
        mensagem: 'Você precisa ter o curso para responder.',
      })

    const txt = texto(corpo.texto).substring(0, 2000)
    if (!txt)
      return e.json(400, { codigo: 'texto_obrigatorio', mensagem: 'Escreva a sua resposta.' })

    // ---- upsert ----
    let r = null
    try {
      r = $app.findFirstRecordByFilter('respostas_fixacao', 'user = {:u} && aula = {:a}', {
        u: auth.id,
        a: aula.id,
      })
    } catch (_) {}

    const novo = !r
    try {
      if (!r) {
        const col = $app.findCollectionByNameOrId('respostas_fixacao')
        r = new Record(col)
        r.set('user', auth.id)
        r.set('aula', aula.id)
      }
      r.set('texto', txt)
      $app.save(r)
    } catch (err) {
      console.log('[ead][fixacao] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível salvar a resposta agora.',
      })
    }

    return e.json(200, { ok: true, novo: novo, tamanho: txt.length })
  },
  $apis.requireAuth(),
)
