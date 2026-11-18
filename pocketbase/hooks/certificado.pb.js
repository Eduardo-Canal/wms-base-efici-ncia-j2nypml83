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

    // ---- PORTÃO (revisão externa, item 12) ----
    // Área fechada: equipe e quem tem matrícula ativa passam; visitante e conta
    // sem matrícula não. Emissão de certificado não existia no portão.
    var areaAbertaPg = false
    try {
      var cfgPg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
      areaAbertaPg = cfgPg.getBool('liberado') === true
    } catch (_pg) {
      areaAbertaPg = false
    }

    const auth = e.requestInfo().auth

    if (!areaAbertaPg) {
      var liberadoPg = false
      try {
        if (auth) {
          if (auth.collection().name === '_superusers') liberadoPg = true
          else {
            var papelPg = String(auth.get('papel'))
            if (papelPg === 'admin' || papelPg === 'suporte') liberadoPg = true
            else {
              var msPg = $app.findRecordsByFilter(
                'matriculas',
                "user = {:u} && status = 'ativa'",
                '',
                1,
                0,
                { u: auth.id },
              )
              if (msPg && msPg.length) liberadoPg = true
            }
          }
        }
      } catch (_pg2) {
        liberadoPg = false
      }
      if (!liberadoPg)
        return e.json(403, {
          codigo: 'ead_fechado',
          mensagem: 'A área de cursos ainda não está aberta.',
        })
    }

    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // ---- 0. MATRÍCULA ATIVA (revisão externa, item 3) ----
    // Antes a emissão olhava só o progresso. Progresso é dado do aluno, mas
    // "ter feito as aulas" não é "ter o curso": quem foi reembolsado, quem
    // perdeu o acesso ou quem só assistiu a amostra não pode receber
    // certificado. A equipe passa para conseguir testar.
    const ehEquipe = (() => {
      try {
        if (auth.collection().name === '_superusers') return true
        const p = String(auth.get('papel'))
        return p === 'admin' || p === 'suporte'
      } catch (_) {
        return false
      }
    })()
    if (!ehEquipe) {
      let temMatricula = false
      try {
        const ms = $app.findRecordsByFilter(
          'matriculas',
          "user = {:u} && curso = {:c} && status = 'ativa'",
          '',
          1,
          0,
          { u: auth.id, c: curso.id },
        )
        temMatricula = !!(ms && ms.length)
      } catch (_) {}
      if (!temMatricula)
        return e.json(403, {
          codigo: 'sem_matricula',
          mensagem: 'O certificado é emitido para quem tem acesso ativo ao curso.',
        })
    }

    // ---- 0b. NOME DO ALUNO (revisão externa, item 3) ----
    // O certificado é um documento: precisa de nome de pessoa. Antes, sem nome,
    // gravava o E-MAIL em nome_aluno — e a validação pública devolvia o e-mail
    // de quem se formou. Exigir o nome resolve na origem.
    const nomeAluno = texto(auth.getString('name'))
    if (!nomeAluno)
      return e.json(409, {
        codigo: 'nome_obrigatorio',
        mensagem:
          'Antes de emitir o certificado, preencha o seu nome completo no perfil. É esse nome que aparece no documento.',
      })

    // ---- 1. já tem certificado? devolve o mesmo (idempotente) ----
    try {
      const ja = $app.findFirstRecordByFilter('certificados', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
      if (ja) {
        // Já emitido: NÃO reescreve nome, curso, carga nem data — o
        // certificado é um documento do passado e não pode ser alterado por
        // quem chega depois. A ÚNICA exceção é o ponteiro da rubrica: se o
        // dono trocou a imagem depois da emissão, o certificado passa a
        // apontar para a nova (a pessoa continua a mesma, o desenho mudou).
        const arqAtual = texto(curso.getString('cert_assinatura'))
        if (arqAtual && !texto(ja.getString('assinatura_arquivo'))) {
          try {
            ja.set('assinatura_arquivo', arqAtual)
            $app.save(ja)
          } catch (_) {}
        }
        let urlRubrica = ''
        try {
          if (texto(ja.getString('assinatura_arquivo'))) urlRubrica = rubricaUrl(curso)
        } catch (_) {}
        return e.json(200, {
          ok: true,
          ja_emitido: true,
          codigo: ja.getString('codigo'),
          emitido_em: ja.getString('emitido_em'),
          assinatura_url: urlRubrica,
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

    // URL pública da rubrica (a imagem vive no curso).
    //
    // TEM QUE SER ABSOLUTA. Medido em 16/11: o domínio do site NÃO roteia
    // /api/files — devolve 404 em HTML — porque /api/* só existe no host do
    // PocketBase. Com caminho relativo a imagem aparece quebrada na tela de
    // verificação (naturalWidth 0), sem erro visível.
    //
    // O host vem de segredo quando existir, para não ficar preso a este
    // projeto; sem segredo, cai no host real do backend.
    function rubricaUrl(cursoRec) {
      var arq = String(cursoRec.getString('cert_assinatura') || '').trim()
      if (!arq) return ''
      var host = ''
      try {
        if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
          var s = $secrets.get('EAD_API_PUBLICA', '')
          if (s) host = String(s)
        }
      } catch (_) {}
      if (!host) {
        try {
          host = String($os.getenv('EAD_API_PUBLICA') || '')
        } catch (_) {}
      }
      if (!host) host = 'https://wms-base-eficiencia-c56b6.shrd01.internal.goskip.dev'
      // Remove barra final para não gerar //api/files
      if (host.charAt(host.length - 1) === '/') host = host.substring(0, host.length - 1)
      return (
        host +
        '/api/files/' +
        cursoRec.collection().id +
        '/' +
        cursoRec.id +
        '/' +
        encodeURIComponent(arq)
      )
    }

    // ---- 4. código de verificação ----
    // Formato legível em voz alta e por telefone: WMS-XXXX-XXXX (sem O/0 e I/1).
    //
    // REVISÃO EXTERNA (item 10): Math.random NÃO é criptográfico — dá para
    // prever a sequência e com isso adivinhar códigos de certificado. Agora usa
    // $security.randomStringWithAlphabet (CSPRNG).
    function gerarCodigo() {
      const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const s = String($security.randomStringWithAlphabet(8, alfa))
      return 'WMS-' + s.substring(0, 4) + '-' + s.substring(4, 8)
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
      // Nome já validado acima: o e-mail NUNCA entra neste campo, porque ele é
      // devolvido pela validação pública.
      c.set('nome_aluno', nomeAluno)
      c.set('titulo_curso', texto(curso.getBool('cert_ativo')) ? curso.getString('titulo') : '')
      if (curso.getString('cert_titulo')) c.set('titulo_curso', curso.getString('cert_titulo'))
      c.set('carga_horas', curso.getInt('cert_carga_horas'))
      c.set('assinante_nome', curso.getString('cert_assinante_nome'))
      c.set('assinante_cargo', curso.getString('cert_assinante_cargo'))
      // Rubrica: guarda o NOME do arquivo para o certificado saber qual
      // imagem usar. A imagem continua no curso (não duplicamos binário).
      c.set('assinatura_arquivo', curso.getString('cert_assinatura'))
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
        assinatura_url: rubricaUrl(curso),
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

  // ---- LIMITE DE REQUISIÇÕES (revisão externa, item 11) ----
  // 30 consultas por minuto por IP. A validação é pública e o código tem 8
  // caracteres: sem limite, um script varre o espaço de códigos e descobre
  // nomes de alunos. Contagem no banco (o limitador nativo não cobre rota
  // própria — testado).
  try {
    const agoraMs = Date.now()
    const janelaMs = 60 * 1000
    const LIMITE = 30
    let ip = ''
    try {
      ip = String(e.realIP() || '')
    } catch (_) {}
    const chave = 'certificado_publico|' + ip

    let reg = null
    try {
      reg = $app.findFirstRecordByFilter('limite_requisicoes', 'chave = {:c}', { c: chave })
    } catch (_) {}

    let contador = 1
    if (reg) {
      const inicioStr = reg.getString('janela_inicio')
      let inicio = 0
      if (inicioStr) {
        const t = new Date(String(inicioStr).replace(' ', 'T')).getTime()
        if (!isNaN(t)) inicio = t
      }
      if (inicio > 0 && agoraMs - inicio < janelaMs) contador = reg.getInt('contador') + 1
      else contador = 1
    }

    if (contador > LIMITE) {
      return e.json(429, {
        codigo: 'muitas_consultas',
        mensagem: 'Muitas consultas em pouco tempo. Aguarde um minuto.',
      })
    }

    if (!reg) {
      const colLim = $app.findCollectionByNameOrId('limite_requisicoes')
      reg = new Record(colLim)
      reg.set('chave', chave)
      reg.set('janela_inicio', new Date().toISOString())
    } else if (contador === 1) {
      reg.set('janela_inicio', new Date().toISOString())
    }
    reg.set('contador', contador)
    $app.save(reg)
  } catch (errLim) {
    console.log('[ead][limite] certificado: ' + errLim.message)
  }

  const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
  if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

  let c = null
  try {
    c = $app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: codigo })
  } catch (_) {}

  // Resposta GENÉRICA para código inexistente: não confirma nem nega padrões,
  // e não ajuda a descobrir códigos válidos por tentativa.
  if (!c) return e.json(404, { valido: false, mensagem: 'Certificado não encontrado.' })

  // Rubrica: o certificado guarda o NOME do arquivo; a imagem está no curso.
  // URL ABSOLUTA do BACKEND: /api/files não é roteado pelo domínio do site
  // (medido em 16/11 — devolve 404 em HTML e a imagem aparece quebrada).
  let assinaturaUrl = ''
  try {
    const arq = String(c.getString('assinatura_arquivo') || '').trim()
    if (arq) {
      const curso = $app.findRecordById('cursos', c.getString('curso'))
      let host = ''
      try {
        host = String($secrets.get('EAD_API_PUBLICA', '') || '')
      } catch (_) {}
      if (!host) host = 'https://wms-base-eficiencia-c56b6.shrd01.internal.goskip.dev'
      assinaturaUrl =
        host +
        '/api/files/' +
        curso.collection().id +
        '/' +
        curso.id +
        '/' +
        encodeURIComponent(arq)
    }
  } catch (_) {}

  // Devolve só o necessário para conferência. Nada de e-mail, id de usuário
  // ou qualquer dado que permita contato — quem tem o código já sabe o nome.
  //
  // REVISÃO EXTERNA (item 3): certificados antigos gravaram o E-MAIL em
  // `nome_aluno` quando faltava nome. Mesmo com a emissão corrigida, os
  // registros antigos continuam no banco — então aqui o campo é higienizado na
  // saída: se o valor parece e-mail, devolve "Aluno(a)". O documento confere
  // pelo código; o e-mail de ninguém sai por rota pública.
  let nomePublico = texto(c.getString('nome_aluno'))
  if (!nomePublico || nomePublico.indexOf('@') !== -1) nomePublico = 'Aluno(a)'

  return e.json(200, {
    valido: true,
    codigo: c.getString('codigo'),
    nome_aluno: nomePublico,
    titulo_curso: c.getString('titulo_curso'),
    carga_horas: c.getInt('carga_horas'),
    assinante_nome: c.getString('assinante_nome'),
    assinante_cargo: c.getString('assinante_cargo'),
    assinatura_url: assinaturaUrl,
    emitido_em: c.getString('emitido_em'),
  })
})
