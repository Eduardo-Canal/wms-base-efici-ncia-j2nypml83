// ead-dores.pb.js — GET /backend/v1/ead/dores?curso=<slug>
//
// LOTE 2, item 4: é a lista da pergunta 3 do diagnóstico.
//
// REGRA: só dores ATIVAS que tenham pelo menos uma aula vinculada NAQUELE curso.
// Uma dor sem aula no curso não pode ser escolhida — o pré-diagnóstico não teria
// aula para recomendar, e a pessoa veria uma pergunta sem resposta possível.

routerAdd(
  'GET',
  '/backend/v1/ead/dores',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    // ATENÇÃO: `e.request.query()` NÃO existe neste runtime — a rota respondia
    // 400 sempre. O acessor correto é `e.request.url.query()`.
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

    // Aulas do curso (todas, publicadas ou não: a dor é do currículo).
    const aulasDoCurso = {}
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, { c: curso.id })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 500, 0, { m: mods[i].id })
        for (let k = 0; k < as.length; k++) aulasDoCurso[as[k].id] = true
      }
    } catch (err) {
      console.log('[ead][dores] falha ao listar aulas: ' + err.message)
    }

    // Dores ativas + quantas aulas têm neste curso.
    const contagem = {}
    try {
      const vinculos = $app.findRecordsByFilter('aula_dores', "id != ''", '', 2000, 0)
      for (let i = 0; i < vinculos.length; i++) {
        const aulaId = String(vinculos[i].getString('aula') || '')
        const dorId = String(vinculos[i].getString('dor') || '')
        if (!aulaId || !dorId) continue
        if (!aulasDoCurso[aulaId]) continue
        contagem[dorId] = (contagem[dorId] || 0) + 1
      }
    } catch (err2) {
      console.log('[ead][dores] falha ao ler aula_dores: ' + err2.message)
    }

    const lista = []
    try {
      const ativas = $app.findRecordsByFilter('dores', 'ativo = true', 'ordem', 100, 0)
      for (let i = 0; i < ativas.length; i++) {
        const id = ativas[i].id
        // Só entra se tem aula neste curso.
        if (!contagem[id]) continue
        lista.push({
          id: id,
          nome: ativas[i].getString('nome'),
          // NÃO devolvo texto_prediagnostico aqui: a pergunta 3 é escolha de
          // dor, não prévia do resultado.
        })
      }
    } catch (err3) {
      console.log('[ead][dores] falha ao listar dores: ' + err3.message)
    }

    return e.json(200, { curso: slug, total: lista.length, dores: lista })
  },
  $apis.requireAuth(),
)
