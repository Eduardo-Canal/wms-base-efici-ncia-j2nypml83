// aula-dores-porta.pb.js — UMA porta de entrada por dor, POR CURSO.
//
// LACUNA QUE EU DEIXEI no comando 1: o seed gravou uma porta por dor, mas nada
// garantia a exclusividade quando o dono marcasse pelo painel. Duas portas para
// a mesma dor fazem o pré-diagnóstico recomendar uma aula arbitrária (ele para
// na primeira que encontra) e o aviso laranja do diagnóstico apontar para uma
// aula diferente da que a Minha área mostra. Regra que só o seed respeita não é
// regra.
//
// ── COMO FUNCIONA ─────────────────────────────────────────────────────────
// `onRecordAfterCreateSuccess` e `onRecordAfterUpdateSuccess` em `aula_dores`:
// se o registro marcado tem `porta_entrada = true`, desmarca qualquer OUTRO
// registro da mesma dor cuja aula pertença ao mesmo curso.
//
// CAMPO `porta_entrada` É BOOLEANO, então "desmarcar" é `false` — não existe
// ausência. Um registro com false continua ligando a aula à dor (a aula trata
// daquela dor); ele só não é a porta.
//
// ── POR QUE POR CURSO E NÃO GLOBAL ────────────────────────────────────────
// A mesma dor existe em vários cursos (rastreabilidade no Fundamentos e no
// Diagnóstico). Cada curso tem a SUA porta de entrada: a primeira aula do curso
// em que o assunto aparece. Desmarcar globalmente deixaria só um curso com
// porta e os outros sem ponto de partida.
//
// ── POR QUE "AFTER" E NÃO "BEFORE" ────────────────────────────────────────
// No before eu teria de adivinhar se o save vai passar (validação do campo,
// erro de disco). No after, o registro está gravado e eu só ajusto os vizinhos.
//
// ⚠ RECURSÃO: desmarcar outro registro dispara este hook de novo. O guarda é
// `porta_entrada = true` na entrada — o registro que eu desmarco entra com
// false e sai na primeira linha. Não há laço.

onRecordAfterCreateSuccess((e) => {
  try {
    if (!e.record.getBool('porta_entrada')) return e.next()

    const dorId = String(e.record.getString('dor') || '')
    const aulaId = String(e.record.getString('aula') || '')
    if (!dorId || !aulaId) return e.next()

    // Curso da aula que virou porta.
    let cursoId = ''
    try {
      const aula = $app.findRecordById('aulas', aulaId)
      const mod = $app.findRecordById('modulos', aula.getString('modulo'))
      cursoId = mod.getString('curso')
    } catch (_) {}
    if (!cursoId) return e.next() // sem curso não há vizinho a desmarcar

    // Aulas do mesmo curso.
    const aulasDoCurso = {}
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, { c: cursoId })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 500, 0, { m: mods[i].id })
        for (let k = 0; k < as.length; k++) aulasDoCurso[as[k].id] = true
      }
    } catch (_) {}

    // Desmarca as outras portas da mesma dor neste curso.
    try {
      const outras = $app.findRecordsByFilter(
        'aula_dores',
        'dor = {:d} && porta_entrada = true',
        '',
        100,
        0,
        { d: dorId },
      )
      for (let i = 0; i < outras.length; i++) {
        if (outras[i].id === e.record.id) continue
        const aulaOutra = String(outras[i].getString('aula') || '')
        if (!aulasDoCurso[aulaOutra]) continue // outro curso: não mexer
        outras[i].set('porta_entrada', false)
        $app.save(outras[i])
        console.log(
          '[ead][porta] desmarcada aula ' +
            aulaOutra +
            ' (dor ' +
            dorId +
            ') porque outra virou porta',
        )
      }
    } catch (err) {
      console.log('[ead][porta] falha ao desmarcar anterior: ' + err.message)
    }
  } catch (errT) {
    console.log('[ead][porta] erro no hook (create): ' + errT.message)
  }
  e.next()
}, 'aula_dores')

onRecordAfterUpdateSuccess((e) => {
  try {
    if (!e.record.getBool('porta_entrada')) return e.next()

    const dorId = String(e.record.getString('dor') || '')
    const aulaId = String(e.record.getString('aula') || '')
    if (!dorId || !aulaId) return e.next()

    let cursoId = ''
    try {
      const aula = $app.findRecordById('aulas', aulaId)
      const mod = $app.findRecordById('modulos', aula.getString('modulo'))
      cursoId = mod.getString('curso')
    } catch (_) {}
    if (!cursoId) return e.next()

    const aulasDoCurso = {}
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, { c: cursoId })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 500, 0, { m: mods[i].id })
        for (let k = 0; k < as.length; k++) aulasDoCurso[as[k].id] = true
      }
    } catch (_) {}

    try {
      const outras = $app.findRecordsByFilter(
        'aula_dores',
        'dor = {:d} && porta_entrada = true',
        '',
        100,
        0,
        { d: dorId },
      )
      for (let i = 0; i < outras.length; i++) {
        if (outras[i].id === e.record.id) continue
        const aulaOutra = String(outras[i].getString('aula') || '')
        if (!aulasDoCurso[aulaOutra]) continue
        outras[i].set('porta_entrada', false)
        $app.save(outras[i])
        console.log('[ead][porta] desmarcada aula ' + aulaOutra + ' (update)')
      }
    } catch (err) {
      console.log('[ead][porta] falha ao desmarcar anterior (update): ' + err.message)
    }
  } catch (errT) {
    console.log('[ead][porta] erro no hook (update): ' + errT.message)
  }
  e.next()
}, 'aula_dores')
