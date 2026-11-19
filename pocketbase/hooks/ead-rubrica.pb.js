// ead-rubrica.pb.js — GET /backend/v1/certificado/{codigo}/rubrica
//
// Serve a imagem da assinatura do CERTIFICADO. A página pública de validação
// NÃO usa esta rota — ela não mostra a rubrica, por decisão do dono.
//
// ── FURO CORRIGIDO (19/11, apontado pelo dono) ────────────────────────────
// DEFEITO QUE EU INTRODUZI: a checagem do dono rodava dentro de `if (auth)` e
// havia `if (!auth) permitido = true` logo abaixo. Resultado: SEM LOGIN a rota
// pulava a autorização e entregava a imagem para quem tivesse o código do
// certificado. E o código é público por desenho — está na página de validação
// e no link do LinkedIn. Na prática, a rubrica continuava aberta, e a coleção
// fechada da 0061 era decoração.
//
// AGORA: sem sessão é 401, sempre. O código do certificado não é credencial de
// nada que não seja o dado público do próprio certificado (nome, curso, data).
// A assinatura do dono é dado pessoal dele.
//
// ── QUEM PODE LER ─────────────────────────────────────────────────────────
//   * o aluno dono do certificado;
//   * admin e suporte (precisam conferir o que enviam).
// Qualquer outro autenticado: 403. Sem sessão: 401.
//
// ── POR QUE UM ENDPOINT E NÃO A URL DE /api/files ─────────────────────────
// A URL de /api/files de coleção protegida exige token de ARQUIVO
// (pb.files.getToken()), um JWT curto separado do token de sessão; qualquer
// erro de montagem dá imagem quebrada em silêncio (naturalWidth 0 — defeito já
// vivido em 16/11). Aqui o servidor confere e devolve os bytes.

routerAdd(
  'GET',
  '/backend/v1/certificado/{codigo}/rubrica',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    // ---- 1. sessão obrigatória (é o furo que existia) ----
    let auth = null
    try {
      auth = e.requestInfo().auth
    } catch (_) {}
    if (!auth)
      return e.json(401, {
        codigo: 'precisa_login',
        mensagem: 'Entre com a conta que recebeu o certificado para ver a assinatura.',
      })

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
    if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

    let cert = null
    try {
      cert = $app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!cert)
      return e.json(404, { codigo: 'nao_encontrado', mensagem: 'Certificado não encontrado.' })

    // ---- 2. é dono do certificado, ou equipe? ----
    let permitido = false
    try {
      if (auth.collection().name === '_superusers') permitido = true
      else {
        const papel = String(auth.get('papel'))
        if (papel === 'admin' || papel === 'suporte') permitido = true
        else if (auth.id === String(cert.getString('user'))) permitido = true
      }
    } catch (_) {}
    if (!permitido)
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Este certificado não é seu.' })

    // ---- 3. a rubrica do curso ----
    let rub = null
    try {
      rub = $app.findFirstRecordByFilter('rubricas', 'curso = {:c}', {
        c: cert.getString('curso'),
      })
    } catch (_) {}
    if (!rub)
      return e.json(404, {
        codigo: 'sem_rubrica',
        mensagem: 'Este certificado não tem assinatura.',
      })

    const nomeArq = String(rub.getString('imagem') || '').trim()
    if (!nomeArq)
      return e.json(404, {
        codigo: 'sem_rubrica',
        mensagem: 'Este certificado não tem assinatura.',
      })

    // Lê os bytes do storage.
    // ⚠ `newFilesystem().get()` não existe no JSVM; o caminho é `getFile` com
    // dirFS sobre o storage do registro.
    let conteudo = null
    try {
      const dir = $os.dirFS($app.dataDir() + '/storage/' + rub.baseFilesPath())
      const fs = $app.newFilesystem()
      conteudo = fs.getFile(dir, nomeArq)
    } catch (err) {
      console.log('[ead][rubrica] falha ao ler arquivo: ' + err.message)
      return e.json(500, {
        codigo: 'leitura_falhou',
        mensagem: 'Não foi possível abrir a assinatura.',
      })
    }

    // content-type pelo sufixo
    let tipo = 'image/png'
    const baixo = nomeArq.toLowerCase()
    if (baixo.endsWith('.jpg') || baixo.endsWith('.jpeg')) tipo = 'image/jpeg'
    else if (baixo.endsWith('.webp')) tipo = 'image/webp'
    else if (baixo.endsWith('.svg')) tipo = 'image/svg+xml'

    // Cache privado: a imagem não muda, e o conteúdo é de um aluno.
    try {
      e.response.header().set('Cache-Control', 'private, max-age=3600')
    } catch (_) {}

    return e.blob(200, tipo, conteudo)
  },
  // requireAuth NÃO é usado aqui de propósito: o middleware devolveria 401
  // antes de eu poder explicar o motivo no corpo. A checagem é a primeira
  // linha do handler e devolve o mesmo 401. O que importa é que NÃO existe
  // caminho sem sessão — era o furo.
)
