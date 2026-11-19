// ead-rubrica.pb.js — GET /backend/v1/certificado/{codigo}/rubrica
//
// FECHA O ITEM 14 DO LOTE 1: serve a imagem da assinatura SÓ para o dono do
// certificado (ou a equipe). A página pública de validação NÃO usa esta rota.
//
// POR QUE UM ENDPOINT E NÃO A URL DE /api/files:
//   * a URL de /api/files de uma coleção protegida exige token de ARQUIVO
//     (pb.files.getToken()), um JWT curto separado do token de sessão, e
//     qualquer erro de montagem dá imagem quebrada em silêncio (naturalWidth 0
//     — defeito já vivido em 16/11);
//   * aqui o servidor confere o certificado e devolve os BYTES com o
//     content-type certo. Uma chamada, sem URL para vazar.

routerAdd(
  'GET',
  '/backend/v1/certificado/{codigo}/rubrica',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
    if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

    let cert = null
    try {
      cert = $app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!cert)
      return e.json(404, { codigo: 'nao_encontrado', mensagem: 'Certificado não encontrado.' })

    // Equipe vê qualquer um; o aluno só o próprio. Sem sessão, o CÓDIGO vale
    // como credencial de leitura — é o mesmo segredo que o link de validação
    // carrega, e só a rubrica é entregue (nada de dado de contato).
    let auth = null
    try {
      auth = e.requestInfo().auth
    } catch (_) {}

    if (auth) {
      const dono = String(cert.getString('user'))
      let permitido = false
      try {
        if (auth.collection().name === '_superusers') permitido = true
        else {
          const papel = String(auth.get('papel'))
          if (papel === 'admin' || papel === 'suporte') permitido = true
          else if (auth.id === dono) permitido = true
        }
      } catch (_) {}
      if (!permitido)
        return e.json(403, { codigo: 'sem_permissao', mensagem: 'Este certificado não é seu.' })
    }

    let rub = null
    try {
      rub = $app.findFirstRecordByFilter('rubricas', 'curso = {:c}', {
        c: cert.getString('curso'),
      })
    } catch (_) {}
    if (!rub)
      return e.json(404, { codigo: 'sem_rubrica', mensagem: 'Este certificado não tem assinatura.' })

    const nomeArq = String(rub.getString('imagem') || '').trim()
    if (!nomeArq)
      return e.json(404, { codigo: 'sem_rubrica', mensagem: 'Este certificado não tem assinatura.' })

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

    return e.blob(200, conteudo, tipo)
  },
  // Sem requireAuth: o código do certificado é a credencial de leitura.
)
