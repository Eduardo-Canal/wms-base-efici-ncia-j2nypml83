// ead-avisar.pb.js — POST /backend/v1/ead/cursos/{slug}/avisar
//
// LOTE 2, item 8: "me avise quando lançar" nos cursos em_breve.
//
// IDEMPOTENTE: avisar duas vezes é a mesma linha (índice único user+curso). A
// resposta não muda, então a tela pode repetir sem medo.

routerAdd(
  'POST',
  '/backend/v1/ead/cursos/{slug}/avisar',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    let ja = null
    try {
      ja = $app.findFirstRecordByFilter('avisos_lancamento', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}

    if (ja) return e.json(200, { ok: true, ja_avisado: true })

    try {
      const col = $app.findCollectionByNameOrId('avisos_lancamento')
      const r = new Record(col)
      r.set('user', auth.id)
      r.set('curso', curso.id)
      $app.save(r)
    } catch (err) {
      console.log('[ead][avisar] falha: ' + err.message)
      return e.json(500, {
        codigo: 'avisar_falhou',
        mensagem: 'Não foi possível registrar o aviso agora.',
      })
    }

    return e.json(200, { ok: true, ja_avisado: false })
  },
  $apis.requireAuth(),
)
