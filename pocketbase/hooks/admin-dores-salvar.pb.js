// admin-dores-salvar.pb.js — POST /backend/v1/ead/admin/dores
// v2: reaplicado para o deploy levar o arquivo.
//
// Cria ou edita uma dor do catálogo. `id` ausente = cria.
//
// POR QUE O NOME É ÚNICO E ISSO IMPORTA: `dores` tem índice único em `nome`.
// Duas dores com o mesmo nome apareceriam duas vezes na pergunta 3 do
// diagnóstico e o pré-diagnóstico somaria as duas como pontos de atenção
// separados. Antes de gravar, confiro se o nome já existe em OUTRO registro e
// devolvo 409 em vez de deixar o PocketBase responder com erro de índice (que a
// tela não sabe explicar).

routerAdd(
  'POST',
  '/backend/v1/ead/admin/dores',
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

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    const nome = texto(corpo.nome).substring(0, 120)
    const ativo = corpo.ativo !== false
    const textoPre = texto(corpo.texto_prediagnostico).substring(0, 600)

    if (!nome) return e.json(400, { codigo: 'nome_obrigatorio', mensagem: 'Dê um nome à dor.' })

    // nome duplicado?
    try {
      const outra = $app.findFirstRecordByFilter('dores', 'nome = {:n}', { n: nome })
      if (outra && outra.id !== id)
        return e.json(409, {
          codigo: 'dor_duplicada',
          mensagem: 'Já existe uma dor com este nome.',
        })
    } catch (_) {}

    let d = null
    if (id) {
      try {
        d = $app.findRecordById('dores', id)
      } catch (_) {}
      if (!d) return e.json(404, { codigo: 'dor_inexistente', mensagem: 'Dor não encontrada.' })
    } else {
      const col = $app.findCollectionByNameOrId('dores')
      d = new Record(col)
      // ordem no fim da lista
      let prox = 1
      try {
        const todas = $app.findRecordsByFilter('dores', "id != ''", '-ordem', 1, 0)
        if (todas.length) prox = todas[0].getInt('ordem') + 1
      } catch (_) {}
      d.set('ordem', prox)
    }

    try {
      d.set('nome', nome)
      d.set('ativo', ativo)
      d.set('texto_prediagnostico', textoPre)
      $app.save(d)
    } catch (err) {
      console.log('[ead][admin-dores] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível salvar a dor.',
      })
    }

    return e.json(200, { ok: true, id: d.id })
  },
  $apis.requireAuth(),
)
