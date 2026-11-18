// admin-bunny-status.pb.js — diagnóstico da integração com o Bunny Stream.
//
//   GET /backend/v1/admin/bunny/status
//
// POR QUE EXISTE (18/11): o vídeo respondia 503 `video_indisponivel` e não dava
// para saber POR QUÊ de fora — o segredo está protegido, e o erro podia ser
// chave ausente, chave errada, biblioteca errada ou vídeo não processado.
// Este endpoint responde as quatro coisas de uma vez, sem expor nenhuma chave.
//
// O QUE ELE FAZ:
//   1. diz quais segredos existem (nunca o valor);
//   2. usa BUNNY_STREAM_API_KEY para listar as bibliotecas da conta no Bunny
//      (GET api.bunny.net/stream/library) — é assim que descobrimos o
//      Library ID sem pedir print de painel;
//   3. lista os vídeos da biblioteca (GET video.bunnycdn.com/library/{id}/videos)
//      e compara com as aulas do banco: quantos casam por video_id;
//   4. aponta o que falta configurar.
//
// SEGURANÇA: só admin. Nenhuma chave sai na resposta — só "existe/não existe",
// nomes de biblioteca e contagens.

routerAdd(
  'GET',
  '/backend/v1/admin/bunny/status',
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

    // ---- 1. segredos presentes? (nunca o valor) ----
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
    const tokenKey = seg('BUNNY_STREAM_TOKEN_KEY')

    const segredos = {
      BUNNY_STREAM_API_KEY: apiKey ? 'configurado' : 'AUSENTE',
      BUNNY_STREAM_LIBRARY_ID: libId ? 'configurado' : 'AUSENTE',
      BUNNY_STREAM_TOKEN_KEY: tokenKey ? 'configurado' : 'AUSENTE',
    }

    // O player só funciona com Library ID + Token Key. A API key serve para
    // administrar (duração, status); sozinha ela não assina embed.
    const playerPronto = !!(libId && tokenKey)

    const resposta = {
      segredos: segredos,
      player_pronto: playerPronto,
      explicacao: playerPronto
        ? 'O player tem o que precisa para assinar a URL do vídeo.'
        : 'O player precisa de BUNNY_STREAM_LIBRARY_ID e BUNNY_STREAM_TOKEN_KEY. A API key sozinha não assina embed.',
      bibliotecas: [],
      videos: { total: 0, casados_com_aula: 0, sem_casamento: 0 },
      aulas: { com_video_id: 0, sem_video_id: 0, com_duracao: 0, sem_duracao: 0 },
      avisos: [],
    }

    if (!apiKey) {
      resposta.avisos.push('Sem BUNNY_STREAM_API_KEY não é possível consultar o Bunny.')
      return e.json(200, resposta)
    }

    // ---- 2. bibliotecas da conta ----
    // A API de conta do Bunny fica em api.bunny.net e usa a mesma AccessKey.
    try {
      const r = $http.send({
        url: 'https://api.bunny.net/stream/library',
        method: 'GET',
        headers: { AccessKey: apiKey, Accept: 'application/json' },
        timeout: 25,
      })
      if (r && r.statusCode >= 200 && r.statusCode < 300) {
        let lista = []
        try {
          lista = JSON.parse(toString(r.body))
        } catch (_) {}
        if (!Array.isArray(lista)) lista = []
        for (let i = 0; i < lista.length; i++) {
          resposta.bibliotecas.push({
            id: String(lista[i].Id || lista[i].id || ''),
            nome: String(lista[i].Name || lista[i].name || ''),
            videos: lista[i].VideoCount || lista[i].videoCount || 0,
            // Diz se a biblioteca cadastrada é esta — o erro mais comum é
            // colar o ID de outra biblioteca da mesma conta.
            eh_a_biblioteca_configurada:
              libId !== '' && String(lista[i].Id || lista[i].id || '') === libId,
          })
        }
        resposta.avisos.push('Bibliotecas consultadas: ' + lista.length + '.')
      } else {
        resposta.avisos.push(
          'A API do Bunny recusou a listagem de bibliotecas (HTTP ' +
            (r ? r.statusCode : '?') +
            '). A AccessKey pode ser de biblioteca e não de conta — nesse caso o Library ID vem do painel.',
        )
      }
    } catch (err) {
      resposta.avisos.push('Falha ao consultar bibliotecas: ' + err.message)
    }

    // ---- 3. vídeos da biblioteca configurada ----
    const videosPorGuid = {}
    if (libId) {
      try {
        const rv = $http.send({
          url:
            'https://video.bunnycdn.com/library/' +
            encodeURIComponent(libId) +
            '/videos?page=1&itemsPerPage=200&orderBy=date',
          method: 'GET',
          headers: { AccessKey: apiKey, Accept: 'application/json' },
          timeout: 25,
        })
        if (rv && rv.statusCode >= 200 && rv.statusCode < 300) {
          let d = {}
          try {
            d = JSON.parse(toString(rv.body))
          } catch (_) {}
          const itens = d.items || d.Items || []
          resposta.videos.total = d.totalItems || itens.length
          for (let i = 0; i < itens.length; i++) {
            const v = itens[i]
            const guid = String(v.guid || v.Guid || '')
            if (guid) {
              videosPorGuid[guid] = {
                titulo: String(v.title || v.Title || ''),
                // `length` é a duração em SEGUNDOS — é a fonte oficial que a
                // revisão externa pediu para preencher em duracao_seg.
                duracao: parseInt(v.length || v.Length || 0, 10) || 0,
                status: v.status || v.Status || 0,
              }
            }
          }
          resposta.avisos.push('Vídeos na biblioteca: ' + itens.length + '.')
        } else {
          resposta.avisos.push(
            'A API recusou a listagem de vídeos da biblioteca ' +
              libId +
              ' (HTTP ' +
              (rv ? rv.statusCode : '?') +
              '). Library ID errado ou a AccessKey não tem acesso a ela.',
          )
        }
      } catch (errV) {
        resposta.avisos.push('Falha ao listar vídeos: ' + errV.message)
      }
    } else {
      resposta.avisos.push('Sem BUNNY_STREAM_LIBRARY_ID não dá para listar vídeos.')
    }

    // ---- 4. compara com as aulas do banco ----
    try {
      const aulas = $app.findRecordsByFilter('aulas', "id != ''", 'ordem', 500, 0)
      for (let i = 0; i < aulas.length; i++) {
        const a = aulas[i]
        let vid = ''
        try {
          const mid = $app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: a.id })
          if (mid) vid = texto(mid.getString('video_id'))
        } catch (_) {}
        if (vid) {
          resposta.aulas.com_video_id++
          if (videosPorGuid[vid]) resposta.videos.casados_com_aula++
          else resposta.videos.sem_casamento++
        } else {
          resposta.aulas.sem_video_id++
        }
        if (a.getInt('duracao_seg') > 0) resposta.aulas.com_duracao++
        else resposta.aulas.sem_duracao++
      }
    } catch (errA) {
      resposta.avisos.push('Falha ao comparar aulas: ' + errA.message)
    }

    // ---- 5. o que falta, em português claro ----
    if (!playerPronto) {
      resposta.avisos.push(
        'BLOQUEIO: o aluno não consegue assistir. Falta ' +
          (!libId ? 'BUNNY_STREAM_LIBRARY_ID' : '') +
          (!libId && !tokenKey ? ' e ' : '') +
          (!tokenKey ? 'BUNNY_STREAM_TOKEN_KEY' : '') +
          '. Os dois estão no painel do Bunny, na biblioteca → aba de API/segurança.',
      )
    }
    if (resposta.aulas.sem_duracao > 0) {
      resposta.avisos.push(
        resposta.aulas.sem_duracao +
          ' aula(s) sem duração cadastrada — essas aulas nunca concluem. Use /admin/bunny/sincronizar.',
      )
    }

    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
