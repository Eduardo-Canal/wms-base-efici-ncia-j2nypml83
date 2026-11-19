// ead-dor-aula.pb.js — GET /backend/v1/ead/dores/{id}/aula?curso=<slug>
// v2: republicado para garantir que o hook suba (o deploy anterior não o levou).
//
// POR QUE ESTA ROTA EXISTE (comando 2, item 3): ao marcar uma dor no
// diagnóstico, a tela precisa dizer QUAL aula recomendar — "Para essa dor,
// comece pela Aula 10: Buscando a máxima performance: ERP x WMS (Módulo 4)".
//
// A REGRA DE QUAL É A AULA BASE JÁ EXISTE no pré-diagnóstico (porta de entrada;
// sem porta, a de menor ordem). Repetir a regra em dois lugares é como as duas
// versões divergem. Esta rota aplica a MESMA regra, e o pré-diagnóstico continua
// calculando do mesmo jeito.
//
// NÃO DEVOLVE NADA ALÉM DO NECESSÁRIO: número, título, módulo e slug da aula.
// Sem vídeo, sem PDF.

routerAdd(
  'GET',
  '/backend/v1/ead/dores/{id}/aula',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const dorId = texto(e.request.pathValue('id'))
    let slug = ''
    try {
      slug = texto(e.request.url.query().get('curso'))
    } catch (_) {}
    if (!slug) return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    let dor = null
    try {
      dor = $app.findRecordById('dores', dorId)
    } catch (_) {}
    if (!dor) return e.json(404, { codigo: 'dor_inexistente', mensagem: 'Dor não encontrada.' })

    // Aulas do curso, com ordem, para escolher a de menor ordem quando não
    // houver porta de entrada.
    const aulasDoCurso = {}
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, { c: curso.id })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          '',
          500,
          0,
          { m: mods[i].id },
        )
        for (let k = 0; k < as.length; k++) {
          aulasDoCurso[as[k].id] = {
            slug: as[k].getString('slug'),
            numero: as[k].getString('numero'),
            titulo: as[k].getString('titulo'),
            ordem: as[k].getInt('ordem'),
            moduloTitulo: mods[i].getString('titulo'),
            moduloOrdem: mods[i].getInt('ordem'),
          }
        }
      }
    } catch (_) {}

    let escolhida = null
    let ehPorta = false
    try {
      const vinculos = $app.findRecordsByFilter('aula_dores', 'dor = {:d}', '', 500, 0, {
        d: dorId,
      })
      for (let i = 0; i < vinculos.length; i++) {
        const aulaId = String(vinculos[i].getString('aula') || '')
        const a = aulasDoCurso[aulaId]
        if (!a) continue
        if (vinculos[i].getBool('porta_entrada')) {
          escolhida = a
          ehPorta = true
          break
        }
        if (!escolhida || a.ordem < escolhida.ordem) escolhida = a
      }
    } catch (_) {}

    if (!escolhida)
      return e.json(200, {
        encontrada: false,
        dor: dor.getString('nome'),
        mensagem: 'Esta dor ainda não tem aula vinculada neste curso.',
      })

    return e.json(200, {
      encontrada: true,
      dor: dor.getString('nome'),
      aula: {
        slug: escolhida.slug,
        numero: escolhida.numero,
        titulo: escolhida.titulo,
        modulo: escolhida.moduloTitulo,
        porta_entrada: ehPorta,
      },
    })
  },
  $apis.requireAuth(),
)
