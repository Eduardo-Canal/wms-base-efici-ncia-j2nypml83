// certificado.pb.js — emissão e verificação do certificado do CURSO.
//
// DECISÃO DO DONO (16/11, 16:00): "o certificado é por CURSO". Antes ele havia
// dito por módulo; corrigiu. Então:
//   * os dados de emissão (título, texto, carga, assinante) vivem no CURSO;
//   * o MÓDULO contribui com o que ele certifica (carga e a lista de conteúdo);
//   * o aluno recebe UM certificado quando conclui todas as aulas publicadas.
//
//   POST /backend/v1/curso/{slug}/certificado   → emite (idempotente)
//   GET  /backend/v1/certificado/{codigo}       → verificação PÚBLICA
//
// POR QUE A VERIFICAÇÃO É PÚBLICA E SEPARADA:
// certificado sem conferência é um PDF que qualquer um edita no editor de
// imagem. O código permite que um recrutador confirme nome, curso, carga e
// data sem que a gente exponha a lista de alunos — por isso a coleção é
// fechada e só o endpoint confere UM código por vez.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

// ---------------------------------------------------------------------------
// Emissão
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/curso/{slug}/certificado',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // ---- 1. já tem certificado? devolve o mesmo (idempotente) ----
    try {
      const ja = $app.findFirstRecordByFilter('certificados', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
      if (ja) {
        return e.json(200, {
          ok: true,
          ja_emitido: true,
          codigo: ja.getString('codigo'),
          emitido_em: ja.getString('emitido_em'),
        })
      }
    } catch (_) {}

    // ---- 2. concluiu mesmo? (checagem no servidor, não na tela) ----
    const aulasPub = []
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: curso.id,
      })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          500,
          0,
          { m: mods[i].id },
        )
        for (let k = 0; k < as.length; k++) aulasPub.push(as[k].id)
      }
    } catch (_) {}

    if (!aulasPub.length)
      return e.json(409, {
        codigo: 'curso_sem_aula',
        mensagem: 'Este curso ainda não tem aula publicada.',
      })

    const set = {}
    try {
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'user = {:u} && concluida = true',
        '',
        2000,
        0,
        { u: auth.id },
      )
      for (let i = 0; i < prog.length; i++) set[prog[i].getString('aula')] = true
    } catch (_) {}

    let feitas = 0
    for (let i = 0; i < aulasPub.length; i++) if (set[aulasPub[i]]) feitas++

    if (feitas < aulasPub.length)
      return e.json(409, {
        codigo: 'curso_incompleto',
        mensagem:
          'Faltam ' +
          (aulasPub.length - feitas) +
          ' aula(s) para concluir o curso. O certificado sai quando todas estiverem concluídas.',
        total: aulasPub.length,
        concluidas: feitas,
      })

    // ---- 3. o curso está configurado para certificar? ----
    if (!curso.getBool('cert_ativo'))
      return e.json(409, {
        codigo: 'certificado_desligado',
        mensagem: 'O certificado deste curso ainda não está liberado.',
      })

    // ---- 4. código de verificação ----
    // Formato legível em voz alta e por telefone: WMS-XXXX-XXXX (sem O/0 e I/1).
    function gerarCodigo() {
      const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let s = ''
      for (let i = 0; i < 8; i++) {
        if (i === 4) s += '-'
        s += alfa.charAt(Math.floor(Math.random() * alfa.length))
      }
      return 'WMS-' + s
    }

    let codigo = gerarCodigo()
    let tentativas = 0
    while (tentativas < 10) {
      let existe = null
      try {
        existe = $app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: codigo })
      } catch (_) {}
      if (!existe) break
      codigo = gerarCodigo()
      tentativas++
    }

    // ---- 5. grava a emissão com CÓPIA dos dados de hoje ----
    // Copiar (e não só apontar para o curso) é o que faz o certificado antigo
    // continuar verdadeiro quando o título do curso ou o assinante mudarem.
    try {
      const col = $app.findCollectionByNameOrId('certificados')
      const c = new Record(col)
      c.set('user', auth.id)
      c.set('curso', curso.id)
      c.set('codigo', codigo)
      c.set('nome_aluno', texto(auth.getString('name')) || texto(auth.getString('email')))
      c.set('titulo_curso', texto(curso.getBool('cert_ativo')) ? curso.getString('titulo') : '')
      if (curso.getString('cert_titulo')) c.set('titulo_curso', curso.getString('cert_titulo'))
      c.set('carga_horas', curso.getInt('cert_carga_horas'))
      c.set('assinante_nome', curso.getString('cert_assinante_nome'))
      c.set('assinante_cargo', curso.getString('cert_assinante_cargo'))
      const agora = new Date().toISOString()
      c.set('emitido_em', agora)
      $app.save(c)

      return e.json(200, {
        ok: true,
        codigo: codigo,
        emitido_em: agora,
        titulo: texto(curso.getString('cert_titulo')) || curso.getString('titulo'),
        carga_horas: curso.getInt('cert_carga_horas'),
        assinante_nome: curso.getString('cert_assinante_nome'),
        assinante_cargo: curso.getString('cert_assinante_cargo'),
        verificar_em: '/certificado/' + codigo,
      })
    } catch (err) {
      console.log('[ead] certificado: emissao falhou: ' + err.message)
      return e.json(400, {
        codigo: 'emissao_falhou',
        mensagem: 'Não foi possível emitir o certificado: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// Verificação pública — qualquer pessoa com o código confere
// ---------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/certificado/{codigo}', (e) => {
  const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

  const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
  if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

  let c = null
  try {
    c = $app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: codigo })
  } catch (_) {}

  // Resposta GENÉRICA para código inexistente: não confirma nem nega padrões,
  // e não ajuda a descobrir códigos válidos por tentativa.
  if (!c) return e.json(404, { valido: false, mensagem: 'Certificado não encontrado.' })

  // Devolve só o necessário para conferência. Nada de e-mail, id de usuário
  // ou qualquer dado que permita contato — quem tem o código já sabe o nome.
  return e.json(200, {
    valido: true,
    codigo: c.getString('codigo'),
    nome_aluno: c.getString('nome_aluno'),
    titulo_curso: c.getString('titulo_curso'),
    carga_horas: c.getInt('carga_horas'),
    assinante_nome: c.getString('assinante_nome'),
    assinante_cargo: c.getString('assinante_cargo'),
    emitido_em: c.getString('emitido_em'),
  })
})
