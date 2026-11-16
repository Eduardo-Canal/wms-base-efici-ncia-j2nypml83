// progresso-curso.pb.js — o progresso do aluno no CURSO (não na aula).
//
//   GET  /backend/v1/curso/{slug}/progresso
//   POST /backend/v1/aula/{slug}/concluir
//
// POR QUE ISSO EXISTE (item 1 da ordem aprovada pelo dono em 16/11):
// já existia `progresso_aulas` gravando aula por aula, mas NADA lia isso de
// volta. O aluno entrava em "Minha área", via o curso e não via "4 de 20". Sem
// esse número, um curso com 20 aulas parece uma pilha de vídeos soltos.
//
// DECISÕES:
// 1. O percentual é CALCULADO, nunca gravado. Gravar percentual cria uma
//    segunda verdade que sai de sincronia quando uma aula é publicada ou
//    despublicada. Só as aulas PUBLICADAS entram na conta — aula em produção
//    não pode baixar o progresso de quem já pagou.
// 2. "Concluir" é ação do aluno (botão). Não há verificação de que ele
//    assistiu. Isso é honesto para curso de livro; está escrito na tela.
// 3. Concluir exige matrícula. Sem isso qualquer pessoa marcaria aula como
//    vista e o progresso viraria enfeite.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

routerAdd(
  'GET',
  '/backend/v1/curso/{slug}/progresso',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    if (!slug) return e.json(400, { codigo: 'slug_obrigatorio', mensagem: 'Curso não informado.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // ---- matrícula: define se o aluno pode ver o progresso deste curso ----
    let matricula = null
    try {
      matricula = $app.findFirstRecordByFilter(
        'matriculas',
        "user = {:u} && curso = {:c} && status = 'ativa'",
        { u: auth.id, c: curso.id },
      )
    } catch (_) {}
    const ehEquipe = (() => {
      try {
        if (auth.collection().name === '_superusers') return true
        const p = String(auth.get('papel'))
        return p === 'admin' || p === 'suporte'
      } catch (_) {
        return false
      }
    })()
    if (!matricula && !ehEquipe)
      return e.json(403, {
        codigo: 'sem_matricula',
        mensagem: 'Você ainda não tem acesso a este curso.',
      })

    // ---- aulas publicadas do curso (as únicas que contam) ----
    const aulasPub = []
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: curso.id,
      })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          500,
          0,
          { m: mods[i].id },
        )
        for (let k = 0; k < as.length; k++) {
          aulasPub.push({ id: as[k].id, slug: as[k].getString('slug') })
        }
      }
    } catch (err) {
      console.log('[ead] progresso: falha ao listar aulas: ' + err.message)
    }

    // ---- quais já foram concluídas ----
    const concluidas = {}
    try {
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'user = {:u} && concluida = true',
        '',
        1000,
        0,
        { u: auth.id },
      )
      for (let i = 0; i < prog.length; i++) {
        concluidas[prog[i].getString('aula')] = true
      }
    } catch (_) {}

    let feitas = 0
    const listaAulas = []
    for (let i = 0; i < aulasPub.length; i++) {
      const a = aulasPub[i]
      const ok = concluidas[a.id] === true
      if (ok) feitas++
      listaAulas.push({ slug: a.slug, concluida: ok })
    }

    const total = aulasPub.length
    // Percentual arredondado. Curso sem aula publicada = 0% (não 100%: nada
    // foi feito, e 100% daria certificado de curso vazio).
    const percentual = total > 0 ? Math.round((feitas / total) * 100) : 0

    // ---- certificado: existe? pode emitir agora? ----
    let certificado = null
    try {
      const c = $app.findFirstRecordByFilter('certificados', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
      if (c) {
        certificado = {
          codigo: c.getString('codigo'),
          emitido_em: c.getString('emitido_em'),
        }
      }
    } catch (_) {}

    return e.json(200, {
      curso: { slug: curso.getString('slug'), titulo: curso.getString('titulo') },
      total: total,
      concluidas: feitas,
      percentual: percentual,
      aulas: listaAulas,
      certificado: certificado,
      // Certificado só quando 100% das aulas publicadas.
      pode_certificar: total > 0 && feitas === total && curso.getBool('cert_ativo'),
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/aula/{slug}/concluir — marca a aula como vista
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/aula/{slug}/concluir',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    let aula = null
    try {
      aula = $app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

    // Precisa de matrícula no curso da aula (a menos que seja amostra).
    let cursoId = ''
    try {
      const mod = $app.findRecordById('modulos', aula.getString('modulo'))
      cursoId = mod.getString('curso')
    } catch (_) {}
    let tem = false
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
        tem = !!(ms && ms.length)
      } catch (_) {}
    }
    if (!tem)
      return e.json(403, {
        codigo: 'sem_matricula',
        mensagem: 'Você precisa ter o curso para marcar a aula como concluída.',
      })

    // Idempotente: marcar duas vezes não duplica (índice único user+aula).
    try {
      let linha = null
      try {
        linha = $app.findFirstRecordByFilter('progresso_aulas', 'user = {:u} && aula = {:a}', {
          u: auth.id,
          a: aula.id,
        })
      } catch (_) {}
      if (!linha) {
        const col = $app.findCollectionByNameOrId('progresso_aulas')
        linha = new Record(col)
        linha.set('user', auth.id)
        linha.set('aula', aula.id)
      }
      linha.set('concluida', true)
      $app.save(linha)
    } catch (err) {
      console.log('[ead] concluir falhou: ' + err.message)
      return e.json(400, {
        codigo: 'concluir_falhou',
        mensagem: 'Não foi possível registrar: ' + err.message,
      })
    }

    // Devolve o progresso novo para a tela atualizar sem recarregar tudo.
    let total = 0
    let feitas = 0
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: cursoId,
      })
      const aulasPub = []
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          500,
          0,
          { m: mods[i].id },
        )
        for (let k = 0; k < as.length; k++) aulasPub.push(as[k].id)
      }
      total = aulasPub.length
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'user = {:u} && concluida = true',
        '',
        1000,
        0,
        { u: auth.id },
      )
      const set = {}
      for (let i = 0; i < prog.length; i++) set[prog[i].getString('aula')] = true
      for (let i = 0; i < aulasPub.length; i++) if (set[aulasPub[i]]) feitas++
    } catch (_) {}

    return e.json(200, {
      ok: true,
      total: total,
      concluidas: feitas,
      percentual: total > 0 ? Math.round((feitas / total) * 100) : 0,
    })
  },
  $apis.requireAuth(),
)
