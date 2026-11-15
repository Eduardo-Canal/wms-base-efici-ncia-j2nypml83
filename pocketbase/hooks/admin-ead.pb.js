// admin-ead.pb.js — endpoints do ADMINISTRADOR do EAD.
//
// O QUE EXISTE AQUI:
//   GET  /backend/v1/admin/config              lê a config (admin vê mesmo fechado)
//   POST /backend/v1/admin/config              salva liberado / textos
//   POST /backend/v1/admin/matricula           libera acesso de um aluno
//   POST /backend/v1/admin/matricula/revogar   tira o acesso
//   GET  /backend/v1/admin/alunos              lista quem tem acesso
//
// POR QUE LIBERAÇÃO MANUAL EXISTE:
// o link de pagamento do Mercado Pago é ESTÁTICO — ele não avisa o sistema quem
// pagou. O fluxo real da fase 1 é: aluno paga → o dono confere no painel do MP →
// libera aqui pelo e-mail. Sem isso ele não vende nem testa com dinheiro real.
// Quando o webhook do MP entrar (fase 2), este endpoint vira o botão de conserto
// de uma liberação que falhou.
//
// SEGURANÇA: toda checagem é AQUI, no servidor. A tela esconde por conveniência;
// quem barra é este arquivo. Aluno que descobrir a rota recebe 403.
//
// As libs comuns são INLINE porque neste projeto `require` local não funciona no
// JSVM. Cada handler roda em escopo isolado: nada fora do callback é visível.

// ---------------------------------------------------------------------------
// GET /backend/v1/admin/config
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/config',
  (e) => {
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
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador acessa esta área.',
      })

    let cfg = null
    try {
      cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    } catch (_) {
      return e.json(500, {
        codigo: 'config_ausente',
        mensagem: 'Configuração do EAD não encontrada.',
      })
    }

    return e.json(200, {
      id: cfg.id,
      liberado: cfg.getBool('liberado'),
      titulo_area: cfg.getString('titulo_area'),
      aviso_rascunho: cfg.getString('aviso_rascunho'),
      instrucoes_compra: cfg.getString('instrucoes_compra'),
      email_suporte: cfg.getString('email_suporte'),
      atualizado_em: cfg.getString('updated'),
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/config
// Salva só os campos que vieram: assim salvar um texto não desliga a liberação
// (o clássico "editei o aviso e o site fechou").
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/config',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, {
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador altera a configuração.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    let cfg = null
    try {
      cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    } catch (_) {
      return e.json(500, {
        codigo: 'config_ausente',
        mensagem: 'Configuração do EAD não encontrada.',
      })
    }

    const txt = (v) => (v === undefined || v === null ? '' : String(v).trim())

    if (corpo.liberado !== undefined) {
      cfg.set('liberado', corpo.liberado === true || corpo.liberado === 'true')
    }
    if (corpo.titulo_area !== undefined) cfg.set('titulo_area', txt(corpo.titulo_area))
    if (corpo.aviso_rascunho !== undefined) cfg.set('aviso_rascunho', txt(corpo.aviso_rascunho))
    if (corpo.instrucoes_compra !== undefined)
      cfg.set('instrucoes_compra', txt(corpo.instrucoes_compra))
    if (corpo.email_suporte !== undefined) cfg.set('email_suporte', txt(corpo.email_suporte))

    try {
      $app.save(cfg)
    } catch (err) {
      return e.json(400, {
        codigo: 'config_invalida',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }

    return e.json(200, {
      ok: true,
      liberado: cfg.getBool('liberado'),
      mensagem: cfg.getBool('liberado')
        ? 'Área liberada ao público.'
        : 'Área fechada: só administradores veem.',
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/matricula — libera (ou renova) o acesso pelo e-mail.
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/matricula',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, {
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador libera acesso.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}
    const txt = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const email = txt(corpo.email).toLowerCase()
    const cursoSlug = txt(corpo.curso_slug)
    const dias = parseInt(txt(corpo.dias) || '0', 10) || 0

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return e.json(400, { codigo: 'email_invalido', mensagem: 'Informe o e-mail do aluno.' })
    if (!cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // O aluno precisa existir. Criar conta aqui seria pior: a pessoa não saberia
    // a senha e o e-mail de "definir senha" ainda não está configurado.
    let user = null
    try {
      user = $app.findAuthRecordByEmail('users', email)
    } catch (_) {}
    if (!user)
      return e.json(404, {
        codigo: 'aluno_inexistente',
        mensagem:
          'Não existe conta com este e-mail. Peça ao aluno para se cadastrar em /ead/entrar antes de liberar.',
      })

    // Já tem matrícula? Renova em vez de duplicar (índice único user+curso).
    let mat = null
    try {
      mat = $app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
        u: user.id,
        c: curso.id,
      })
    } catch (_) {}

    if (!mat) {
      const col = $app.findCollectionByNameOrId('matriculas')
      mat = new Record(col)
      mat.set('user', user.id)
      mat.set('curso', curso.id)
      mat.set('origem', 'manual')
    }
    mat.set('status', 'ativa')
    if (dias > 0) {
      mat.set('expira_em', new Date(Date.now() + dias * 86400000).toISOString())
    } else {
      mat.set('expira_em', '')
    }

    try {
      $app.save(mat)
    } catch (err) {
      return e.json(400, {
        codigo: 'matricula_falhou',
        mensagem: 'Não foi possível liberar: ' + err.message,
      })
    }

    return e.json(200, {
      ok: true,
      matricula_id: mat.id,
      aluno: email,
      curso: cursoSlug,
      expira_em: mat.getString('expira_em'),
      mensagem: 'Acesso liberado para ' + email + '.',
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/matricula/revogar
// Revoga por status, sem apagar: o histórico de quem teve acesso fica.
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/matricula/revogar',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, {
        codigo: 'sem_permissao',
        mensagem: 'Só o administrador revoga acesso.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}
    const txt = (v) => (v === undefined || v === null ? '' : String(v).trim())
    const email = txt(corpo.email).toLowerCase()
    const cursoSlug = txt(corpo.curso_slug)

    if (!email || !cursoSlug)
      return e.json(400, {
        codigo: 'dados_incompletos',
        mensagem: 'Informe e-mail e curso.',
      })

    let user = null
    try {
      user = $app.findAuthRecordByEmail('users', email)
    } catch (_) {}
    if (!user)
      return e.json(404, { codigo: 'aluno_inexistente', mensagem: 'Aluno não encontrado.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    let mat = null
    try {
      mat = $app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
        u: user.id,
        c: curso.id,
      })
    } catch (_) {}
    if (!mat)
      return e.json(404, {
        codigo: 'sem_matricula',
        mensagem: 'Este aluno não tem matrícula neste curso.',
      })

    // 'reembolsada' é o status que existe no esquema para "não deve mais acesso".
    // 'expirada' também serve; usamos reembolsada só quando o motivo é reembolso.
    mat.set('status', 'expirada')
    try {
      $app.save(mat)
    } catch (err) {
      return e.json(400, {
        codigo: 'revogacao_falhou',
        mensagem: 'Não foi possível revogar: ' + err.message,
      })
    }

    return e.json(200, { ok: true, mensagem: 'Acesso revogado.' })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// GET /backend/v1/admin/alunos — quem tem acesso, para a tabela do painel.
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/alunos',
  (e) => {
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
        codigo: 'sem_permissao',
        mensagem: 'Só a equipe acessa esta área.',
      })

    const lista = []
    try {
      // sort '' — `matriculas` não tem `created` (tem `criado_em`); ordenar por
      // campo inexistente faz a consulta lançar. Bug já visto neste projeto.
      const mats = $app.findRecordsByFilter('matriculas', "id != ''", 'criado_em', 200, 0)
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i]
        let email = ''
        let nome = ''
        try {
          const u = $app.findRecordById('users', m.getString('user'))
          email = u.getString('email')
          nome = u.getString('name')
        } catch (_) {}
        let cursoSlug = ''
        let cursoTitulo = ''
        try {
          const c = $app.findRecordById('cursos', m.getString('curso'))
          cursoSlug = c.getString('slug')
          cursoTitulo = c.getString('titulo')
        } catch (_) {}
        lista.push({
          id: m.id,
          email: email,
          nome: nome,
          curso_slug: cursoSlug,
          curso_titulo: cursoTitulo,
          status: m.getString('status'),
          origem: m.getString('origem'),
          expira_em: m.getString('expira_em'),
          criado_em: m.getString('criado_em'),
        })
      }
    } catch (err) {
      return e.json(500, {
        codigo: 'lista_falhou',
        mensagem: 'Não foi possível listar os alunos: ' + err.message,
      })
    }

    return e.json(200, { total: lista.length, alunos: lista })
  },
  $apis.requireAuth(),
)
