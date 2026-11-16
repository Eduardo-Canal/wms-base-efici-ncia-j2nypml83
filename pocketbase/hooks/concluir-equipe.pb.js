// concluir-equipe.pb.js — POST /backend/v1/aula/{slug}/concluir
//
// Era o botão do aluno. A decisão (a) do dono (16/11 17:03: conclusão
// automática por tempo assistido) eliminou o botão: agora a aula conclui
// sozinha em ~90% do vídeo, medida no servidor (progresso-aula.pb.js).
//
// Esta rota continua existindo — restrita à EQUIPE — para o conserto que vai
// acontecer de verdade: vídeo que não tocou na máquina do aluno, aula
// assistida presencialmente, player bloqueado por extensão. Quem responde por
// isso é o dono, não o aluno.
//
// Arquivo separado porque o Skip Cloud exige UM routerAdd por arquivo.

routerAdd(
  'POST',
  '/backend/v1/aula/{slug}/concluir',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let equipe = false
    try {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const p = String(auth.get('papel'))
        equipe = p === 'admin' || p === 'suporte'
      }
    } catch (_) {}
    if (!equipe)
      return e.json(403, {
        codigo: 'somente_equipe',
        mensagem: 'A aula é concluída automaticamente ao assistir. Só a equipe marca manualmente.',
      })

    const slug = texto(e.request.pathValue('slug'))
    let aula = null
    try {
      aula = $app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

    // De quem é o progresso: o próprio admin, ou um e-mail informado no corpo.
    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}
    const email = texto(corpo.email).toLowerCase()

    let alvo = auth.id
    if (email) {
      let user = null
      try {
        user = $app.findAuthRecordByEmail('users', email)
      } catch (_) {}
      if (!user)
        return e.json(404, { codigo: 'aluno_inexistente', mensagem: 'Aluno não encontrado.' })
      alvo = user.id
    }

    try {
      let linha = null
      try {
        linha = $app.findFirstRecordByFilter('progresso_aulas', 'user = {:u} && aula = {:a}', {
          u: alvo,
          a: aula.id,
        })
      } catch (_) {}
      if (!linha) {
        const col = $app.findCollectionByNameOrId('progresso_aulas')
        linha = new Record(col)
        linha.set('user', alvo)
        linha.set('aula', aula.id)
      }
      linha.set('concluida', true)
      $app.save(linha)
    } catch (err) {
      return e.json(400, { codigo: 'concluir_falhou', mensagem: 'Falhou: ' + err.message })
    }

    return e.json(200, { ok: true, mensagem: 'Aula marcada como concluída pela equipe.' })
  },
  $apis.requireAuth(),
)
