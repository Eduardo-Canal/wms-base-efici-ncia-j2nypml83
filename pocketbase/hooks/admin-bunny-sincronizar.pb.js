// admin-bunny-sincronizar.pb.js — preenche `duracao_seg` pela API do Bunny.
//
//   POST /backend/v1/admin/bunny/sincronizar   { curso_slug? }
//
// POR QUE EXISTE: revisão externa, item 2. As 20 aulas importadas pela migration
// 0020 estão sem `duracao_seg`, e sem duração a aula NUNCA conclui (correção
// aplicada em progresso-aula.pb.js). Preencher à mão, aula por aula, no painel,
// é o caminho que ninguém faz — e o erro aparece só quando o aluno reclama que
// não consegue terminar o curso.
//
// A FONTE: `length` do vídeo na API do Bunny (segundos), que é a duração real
// do arquivo. É a mesma fonte que a revisão pediu.
//
// O QUE ELE **NÃO** FAZ: não sobrescreve duração que já existe, a menos que o
// dono peça `forcar: true`. Duração cadastrada pode ter sido ajustada de
// propósito (cortar o encerramento, por exemplo), e sobrescrever seria perder
// essa decisão.
//
// SEGURANÇA: só admin. Nenhuma chave sai na resposta.

routerAdd(
  'POST',
  '/backend/v1/admin/bunny/sincronizar',
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

    const seg = (nome) => {
      try {
        if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
          const v = $secrets.get(nome, '')
          if (v) return String(v)
        }
      } catch (_) {}
      try {
        const v2 = $os.getenv(nome)
        return v2 ? String(v2) : ''
      } catch (_) {}
      return ''
    }

    const apiKey = seg('BUNNY_STREAM_API_KEY')
    const libId = seg('BUNNY_STREAM_LIBRARY_ID')

    if (!apiKey)
      return e.json(409, {
        codigo: 'sem_api_key',
        mensagem: 'Falta a BUNNY_STREAM_API_KEY nos segredos do projeto.',
      })
    if (!libId)
      return e.json(409, {
        codigo: 'sem_library_id',
        mensagem:
          'Falta a BUNNY_STREAM_LIBRARY_ID. Use GET /backend/v1/admin/bunny/status para descobrir o ID da sua biblioteca.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}
    const forcar = corpo.forcar === true || corpo.forcar === 'true'
    const cursoSlug = texto(corpo.curso_slug).toLowerCase()

    // ---- busca os vídeos da biblioteca uma vez ----
    const porGuid = {}
    let totalVideos = 0
    try {
      let pagina = 1
      let continuar = true
      while (continuar && pagina <= 10) {
        const r = $http.send({
          url:
            'https://video.bunnycdn.com/library/' +
            encodeURIComponent(libId) +
            '/videos?page=' +
            pagina +
            '&itemsPerPage=100&orderBy=date',
          method: 'GET',
          headers: { AccessKey: apiKey, Accept: 'application/json' },
          timeout: 25,
        })
        if (!r || r.statusCode < 200 || r.statusCode >= 300) {
          return e.json(502, {
            codigo: 'bunny_recusou',
            mensagem:
              'A API do Bunny recusou a consulta (HTTP ' +
              (r ? r.statusCode : '?') +
              '). Confira a API key e o Library ID.',
          })
        }
        let d = {}
        try {
          d = JSON.parse(toString(r.body))
        } catch (_) {}
        const itens = d.items || d.Items || []
        for (let i = 0; i < itens.length; i++) {
          const v = itens[i]
          const guid = String(v.guid || v.Guid || '')
          if (guid) {
            porGuid[guid] = parseInt(v.length || v.Length || 0, 10) || 0
            totalVideos++
          }
        }
        if (!itens.length || itens.length < 100) continuar = false
        else pagina++
      }
    } catch (err) {
      console.log('[ead][bunny-sync] falha ao listar videos: ' + err.message)
      return e.json(502, {
        codigo: 'bunny_falhou',
        mensagem: 'Não foi possível consultar o Bunny agora.',
      })
    }

    // ---- quais aulas atualizar ----
    let aulas = []
    try {
      let filtro = "id != ''"
      const params = {}
      if (cursoSlug) {
        const curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
        if (!curso)
          return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })
        // Aulas do curso: pega os módulos e filtra depois.
        const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, {
          c: curso.id,
        })
        for (let i = 0; i < mods.length; i++) {
          const as = $app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 500, 0, {
            m: mods[i].id,
          })
          for (let k = 0; k < as.length; k++) aulas.push(as[k])
        }
      } else {
        aulas = $app.findRecordsByFilter('aulas', filtro, 'ordem', 500, 0)
      }
    } catch (errA) {
      return e.json(500, { codigo: 'lista_falhou', mensagem: 'Não foi possível listar as aulas.' })
    }

    let atualizadas = 0
    let jaTinham = 0
    let semMidia = 0
    let naoAchadoNoBunny = 0
    const detalhes = []

    for (let i = 0; i < aulas.length; i++) {
      const aula = aulas[i]
      const atual = aula.getInt('duracao_seg')

      if (atual > 0 && !forcar) {
        jaTinham++
        continue
      }

      let videoId = ''
      try {
        const mid = $app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: aula.id })
        if (mid) videoId = texto(mid.getString('video_id'))
      } catch (_) {}

      if (!videoId) {
        semMidia++
        continue
      }

      const dur = porGuid[videoId]
      if (!dur || dur <= 0) {
        naoAchadoNoBunny++
        detalhes.push({ slug: aula.getString('slug'), motivo: 'video_ausente_ou_sem_duracao' })
        continue
      }

      try {
        aula.set('duracao_seg', dur)
        $app.save(aula)
        atualizadas++
        detalhes.push({
          slug: aula.getString('slug'),
          duracao_seg: dur,
          antes: atual,
        })
      } catch (errS) {
        detalhes.push({ slug: aula.getString('slug'), motivo: 'falha_ao_salvar' })
        console.log('[ead][bunny-sync] falha em ' + aula.getString('slug') + ': ' + errS.message)
      }
    }

    return e.json(200, {
      ok: true,
      biblioteca: libId,
      videos_na_biblioteca: totalVideos,
      aulas_verificadas: aulas.length,
      atualizadas: atualizadas,
      ja_tinham_duracao: jaTinham,
      sem_midia: semMidia,
      nao_encontradas_no_bunny: naoAchadoNoBunny,
      detalhes: detalhes,
      mensagem:
        atualizadas > 0
          ? atualizadas + ' aula(s) com duração preenchida pelo Bunny.'
          : 'Nenhuma aula precisava de duração.',
    })
  },
  $apis.requireAuth(),
)
