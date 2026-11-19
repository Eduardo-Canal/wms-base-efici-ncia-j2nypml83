// admin-aula-dores.pb.js — marcação de dores numa aula (comando 3, item 2)
// v2: reaplicado para o deploy levar o arquivo.
//
//   GET  /backend/v1/ead/admin/aula-dores?aula=<id>
//   POST /backend/v1/ead/admin/aula-dores  { aula, dores[], porta_entrada }
//
// POR QUE UM ENDPOINT SÓ PARA ISSO: a marcação é um CONJUNTO. Gravar item por
// item pela API da coleção deixaria o meio-caminho visível para o aluno (metade
// das dores marcadas, porta de entrada apontando para aula que já não tem a
// dor). Aqui, tudo dentro de `runInTransaction`: ou o conjunto vale, ou nada
// mudou.
//
// A EXCLUSIVIDADE DA PORTA é garantida pelo hook `aula-dores-porta.pb.js`. Este
// endpoint NÃO repete a regra — e a razão é a de sempre: regra em dois lugares
// diverge. Ele só grava o que o admin escolheu; o hook arruma os vizinhos.

routerAdd(
  'GET',
  '/backend/v1/ead/admin/aula-dores',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    let aulaId = ''
    try {
      aulaId = texto(e.request.url.query().get('aula'))
    } catch (_) {}
    if (!aulaId) return e.json(400, { codigo: 'aula_obrigatoria', mensagem: 'Informe a aula.' })

    const dores = []
    let porta = ''
    try {
      const vinculos = $app.findRecordsByFilter('aula_dores', 'aula = {:a}', '', 50, 0, {
        a: aulaId,
      })
      for (let i = 0; i < vinculos.length; i++) {
        const dorId = String(vinculos[i].getString('dor') || '')
        if (dorId) dores.push(dorId)
        if (vinculos[i].getBool('porta_entrada') && dorId) porta = dorId
      }
    } catch (err) {
      console.log('[ead][aula-dores] falha ao ler: ' + err.message)
    }

    return e.json(200, { dores: dores, porta_entrada: porta })
  },
  $apis.requireAuth(),
)
