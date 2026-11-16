// admin-assinatura.pb.js — upload da RUBRICA do certificado.
//
//   POST /backend/v1/admin/curso/assinatura   { curso_slug } + arquivo
//   GET  /backend/v1/admin/curso/assinatura/{slug}   → estado atual
//
// DECISÃO DO DONO (16/11 16:45): "vamos colocar uma imagem de assinatura
// (rubrica), teremos que ter um download desta imagem e vincular ao
// certificado".
//
// POR QUE UM ENDPOINT PRÓPRIO E NÃO UM PATCH NO REGISTRO:
// `cursos` tem updateRule nulo (só o servidor escreve), e upload de arquivo no
// PocketBase exige multipart — não dá para mandar pelo mesmo POST JSON da
// configuração. Um endpoint só para isso mantém a regra de admin num lugar.
//
// SEGURANÇA: checa admin, checa tipo e tamanho ANTES de gravar, e recusa
// arquivo que não seja imagem. Rubrica não é segredo (aparece no certificado
// que o aluno baixa), então o arquivo é servido publicamente — diferente do PDF
// de aula paga, que sai por endpoint com checagem de matrícula.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

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

    const arq = curso.getString('cert_assinatura')
    return e.json(200, {
      tem_assinatura: arq !== '',
      arquivo: arq,
      // URL pronta para <img>. O PocketBase monta /api/files/{coleção}/{id}/{arquivo}
      url: arq
        ? '/api/files/' + curso.collection().id + '/' + curso.id + '/' + encodeURIComponent(arq)
        : '',
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
    let corpo = info.body || {}

    const cursoSlug = texto(corpo.curso_slug)
    if (!cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso) return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não existe.' })

    // O arquivo chega em `files` (multipart). O PocketBase já valida mimeTypes
    // e maxSize no campo; aqui só confirmamos que veio algo.
    let arquivos = []
    try {
      arquivos = e.findUploadedFiles('cert_assinatura')
    } catch (_) {}
    if (!arquivos || !arquivos.length) {
      // Sem arquivo no multipart: pode ser o caso de APAGAR a rubrica.
      if (corpo.remover === true || corpo.remover === 'true') {
        curso.set('cert_assinatura', '')
        try {
          $app.save(curso)
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
      curso.set('cert_assinatura', arquivos[0])
      $app.save(curso)
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

    const arq = curso.getString('cert_assinatura')
    return e.json(200, {
      ok: true,
      arquivo: arq,
      url: '/api/files/' + curso.collection().id + '/' + curso.id + '/' + encodeURIComponent(arq),
      mensagem: 'Rubrica enviada.',
    })
  },
  $apis.requireAuth(),
)
