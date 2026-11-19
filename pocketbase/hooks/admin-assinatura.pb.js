// admin-assinatura.pb.js — upload da RUBRICA do certificado.
//
//   POST /backend/v1/admin/curso/assinatura   { curso_slug } + arquivo
//   GET  /backend/v1/admin/curso/assinatura/{slug}   → estado atual
//
// ── O QUE MUDOU (item 14 do lote 1 / item 6 do comando 2) ─────────────────
// Antes a imagem ia para `cursos.cert_assinatura`, servido por URL pública
// (/api/files/cursos/...). Qualquer pessoa com o link baixava a assinatura.
// Agora vai para a coleção `rubricas`, cuja regra exige usuário autenticado com
// certificado emitido (ou a equipe). O campo antigo é limpo aqui a cada gravação
// — se voltasse a ser escrito, a proteção seria decorativa.
//
// POR QUE UM ENDPOINT PRÓPRIO E NÃO UM PATCH NO REGISTRO: `rubricas` tem
// createRule nulo (só o servidor escreve) e upload exige multipart, que não
// passa pelo POST JSON da configuração.

routerAdd(
  'GET',
  '/backend/v1/admin/curso/assinatura/{slug}',
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
    if (!equipe) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só a equipe acessa.' })

    const slug = texto(e.request.pathValue('slug'))
    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso) return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não existe.' })

    let rub = null
    try {
      rub = $app.findFirstRecordByFilter('rubricas', 'curso = {:c}', { c: curso.id })
    } catch (_) {}

    const temNova = !!(rub && texto(rub.getString('imagem')))
    const antiga = texto(curso.getString('cert_assinatura'))

    return e.json(200, {
      tem_assinatura: temNova,
      arquivo: rub ? texto(rub.getString('imagem')) : '',
      // Sem URL de arquivo: a imagem sai por /backend/v1/certificado/{codigo}/rubrica,
      // que confere quem pede. Devolver uma URL pública aqui reintroduziria o furo.
      assinante_nome: rub ? texto(rub.getString('assinante_nome')) : '',
      assinante_cargo: rub ? texto(rub.getString('assinante_cargo')) : '',
      aviso: antiga ? 'Ainda existe imagem no campo antigo (cert_assinatura); será ignorada.' : '',
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admin/curso/assinatura',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin)
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador envia.' })

    let info = {}
    try {
      info = e.requestInfo()
    } catch (_) {}
    const corpo = info.body || {}

    const cursoSlug = texto(corpo.curso_slug)
    if (!cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso) return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não existe.' })

    let rub = null
    try {
      rub = $app.findFirstRecordByFilter('rubricas', 'curso = {:c}', { c: curso.id })
    } catch (_) {}
    const novo = !rub
    if (!rub) {
      const colRub = $app.findCollectionByNameOrId('rubricas')
      rub = new Record(colRub)
      rub.set('curso', curso.id)
    }

    let arquivos = []
    try {
      arquivos = e.findUploadedFiles('cert_assinatura')
    } catch (_) {}

    if (!arquivos || !arquivos.length) {
      if (corpo.remover === true || corpo.remover === 'true') {
        if (novo) return e.json(200, { ok: true, remover: true, mensagem: 'Não havia rubrica.' })
        try {
          rub.set('imagem', '')
          $app.save(rub)
          if (texto(curso.getString('cert_assinatura'))) {
            curso.set('cert_assinatura', '')
            $app.save(curso)
          }
          return e.json(200, { ok: true, remover: true, mensagem: 'Rubrica removida.' })
        } catch (errDel) {
          return e.json(400, {
            codigo: 'falhou',
            mensagem: 'Não foi possível remover: ' + errDel.message,
          })
        }
      }
      return e.json(400, {
        codigo: 'arquivo_ausente',
        mensagem: 'Envie a imagem da assinatura no campo cert_assinatura.',
      })
    }

    try {
      rub.set('imagem', arquivos[0])
      if (corpo.assinante_nome)
        rub.set('assinante_nome', texto(corpo.assinante_nome).substring(0, 160))
      if (corpo.assinante_cargo)
        rub.set('assinante_cargo', texto(corpo.assinante_cargo).substring(0, 160))
      $app.save(rub)

      // Garante que o campo antigo fique vazio: é ele que vazava.
      if (texto(curso.getString('cert_assinatura'))) {
        curso.set('cert_assinatura', '')
        $app.save(curso)
      }
    } catch (err) {
      console.log('[ead] assinatura: falhou: ' + err.message)
      return e.json(400, {
        codigo: 'upload_falhou',
        mensagem:
          'Não foi possível salvar a imagem: ' +
          err.message +
          ' (aceitamos PNG, JPG, WEBP ou SVG até 2 MB)',
      })
    }

    return e.json(200, {
      ok: true,
      arquivo: texto(rub.getString('imagem')),
      mensagem:
        'Rubrica enviada. Ela passa a aparecer nos certificados emitidos a partir de agora.',
    })
  },
  $apis.requireAuth(),
)
