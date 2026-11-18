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

    // REVISÃO EXTERNA (item 13): antes o papel `suporte` marcava aula de
    // QUALQUER aluno sem deixar rastro. Quem é suporte atende aluno; não deve
    // poder fabricar conclusão de curso no nome de outra pessoa. Restrito a
    // admin e superusuário, e TODA marcação fica registrada no log com quem
    // marcou, para quem e quando.
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, {
        codigo: 'somente_admin',
        mensagem:
          'A aula é concluída automaticamente ao assistir. Só o administrador marca manualmente.',
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
      // Erro interno não vaza para o cliente.
      console.log('[ead][concluir-equipe] falhou: ' + err.message)
      return e.json(500, {
        codigo: 'concluir_falhou',
        mensagem: 'Não foi possível marcar a aula agora.',
      })
    }

    // Registro de auditoria: quem marcou, para quem, quando.
    try {
      const logCol = $app.findCollectionByNameOrId('log_acessos')
      const lg = new Record(logCol)
      lg.set('user', alvo)
      lg.set('aula', aula.id)
      lg.set(
        'user_agent',
        'conclusao manual por ' +
          String(auth.getString('email') || auth.id) +
          ' em ' +
          new Date().toISOString(),
      )
      lg.set('em', new Date().toISOString())
      lg.set('tipo', 'conclusao_manual')
      $app.save(lg)
    } catch (eLog) {
      // Log tem campo obrigatório próprio; falha aqui não desfaz a conclusão,
      // mas deixa rastro no log do runtime.
      console.log('[ead][concluir-equipe] auditoria falhou: ' + eLog.message)
    }

    return e.json(200, { ok: true, mensagem: 'Aula marcada como concluída pela equipe.' })
  },
  $apis.requireAuth(),
)
