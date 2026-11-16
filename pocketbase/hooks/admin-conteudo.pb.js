// admin-conteudo.pb.js — o dono monta o curso pelo painel: módulos e aulas.
//
// O QUE O DONO PEDIU (16/11, 15:40): "um lugar de configuração do curso, de
// poder subir as aulas com o link, com nome e descrição da aula".
//
// O PROBLEMA REAL: os campos já existiam no banco (`titulo`, `descricao`,
// `numero`, `ordem`, `slug`) e `aulas_midia` já guardava o vídeo — mas NÃO
// existia tela nenhuma. O curso só podia ser montado por migration/SQL.
// Ou seja: a estrutura estava pronta e inacessível.
//
// DECISÕES QUE ESTÃO AQUI (e o porquê):
//
// 1. O LINK DO VÍDEO É COLADO PELO DONO. Ele não vai integrar API do Bunny
//    para cada aula; ele cola a URL que o Bunny dá. O servidor EXTRAI o id e
//    guarda normalizado — o player continua montando URL assinada e o
//    video_id nunca vaza para o cliente.
//
// 2. O SLUG É GERADO PELO SERVIDOR a partir do prefixo do curso + número.
//    Slug digitado à mão colide e quebra rota (já aconteceu: `a01` colidiu
//    porque não carregava o curso). O dono digita o título; o slug sai certo.
//
// 3. `ordem` É CALCULADA, não digitada. Se o dono tivesse que acertar a ordem
//    de 20 aulas na mão, erraria — e o índice único (modulo, ordem) recusaria
//    o save com erro técnico incompreensível. Aqui ele só escolhe a posição.
//
// 4. PUBLICAR EXIGE VÍDEO. Aula publicada sem vídeo apareceria no curso e
//    cairia em "em produção" — experiência quebrada para quem pagou. O
//    servidor recusa (409) e explica.
//
// 5. NADA É APAGADO DE VERDADE se houver progresso. Aula com aluno que já
//    assistiu é DESPUBLICADA, não apagada: apagar levaria junto o progresso
//    (`progresso_aulas` tem cascade) e o histórico de quem estudou.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

routerAdd(
  'GET',
  '/backend/v1/admin/conteudo',
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
    if (!equipe) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só a equipe acessa.' })

    const cursos = []
    try {
      const listaCursos = $app.findRecordsByFilter('cursos', "id != ''", 'ordem', 50, 0)
      for (let i = 0; i < listaCursos.length; i++) {
        const c = listaCursos[i]
        const modulos = []
        let listaMod = []
        try {
          listaMod = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 100, 0, {
            c: c.id,
          })
        } catch (_) {}

        for (let k = 0; k < listaMod.length; k++) {
          const m = listaMod[k]
          const aulas = []
          let listaAulas = []
          try {
            listaAulas = $app.findRecordsByFilter('aulas', 'modulo = {:m}', 'ordem', 200, 0, {
              m: m.id,
            })
          } catch (_) {}

          for (let a = 0; a < listaAulas.length; a++) {
            const au = listaAulas[a]
            let videoId = ''
            let videoPronto = false
            try {
              const mid = $app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: au.id })
              if (mid) {
                videoId = mid.getString('video_id')
                videoPronto = mid.getString('status') === 'pronto'
              }
            } catch (_) {}

            let temAluno = false
            try {
              const prog = $app.findRecordsByFilter(
                'progresso_aulas',
                'aula = {:a} && concluida = true',
                '',
                1,
                0,
                { a: au.id },
              )
              temAluno = !!(prog && prog.length)
            } catch (_) {}

            aulas.push({
              id: au.id,
              slug: au.getString('slug'),
              numero: au.getString('numero'),
              titulo: au.getString('titulo'),
              descricao: au.getString('descricao'),
              ordem: au.getInt('ordem'),
              duracao_seg: au.getInt('duracao_seg'),
              publicado: au.getBool('publicado'),
              amostra: au.getBool('amostra'),
              pergunta_fixacao: au.getString('pergunta_fixacao'),
              material_url: au.getString('material_url'),
              video_id: videoId,
              video_pronto: videoPronto,
              tem_aluno: temAluno,
            })
          }

          modulos.push({
            id: m.id,
            slug: m.getString('slug'),
            titulo: m.getString('titulo'),
            ordem: m.getInt('ordem'),
            aulas: aulas,
          })
        }

        // Capítulos (partes) do curso — o dono decidiu (16/11) que o
        // Capítulo 2 entra como mais módulos no MESMO curso, então o nível de
        // agrupamento é o que dá a divisão visível para o aluno.
        const partes = []
        try {
          const listaPartes = $app.findRecordsByFilter('partes', 'curso = {:c}', 'ordem', 100, 0, {
            c: c.id,
          })
          for (let p = 0; p < listaPartes.length; p++) {
            const pp = listaPartes[p]
            partes.push({
              id: pp.id,
              slug: pp.getString('slug'),
              titulo: pp.getString('titulo'),
              rotulo: pp.getString('rotulo'),
              resumo: pp.getString('resumo'),
              ordem: pp.getInt('ordem'),
              publicado: pp.getBool('publicado'),
            })
          }
        } catch (_) {}

        let produto = null
        try {
          produto = $app.findFirstRecordByFilter('produtos', 'cursos ~ {:c}', { c: c.id })
        } catch (_) {}

        cursos.push({
          id: c.id,
          slug: c.getString('slug'),
          titulo: c.getString('titulo'),
          publicado: c.getBool('publicado'),
          carga_min: c.getInt('carga_min'),
          produto_slug: produto ? produto.getString('slug') : '',
          // dados do certificado (decisão: por curso)
          cert_ativo: c.getBool('cert_ativo'),
          cert_titulo: c.getString('cert_titulo'),
          cert_texto: c.getString('cert_texto'),
          cert_carga_horas: c.getInt('cert_carga_horas'),
          cert_assinante_nome: c.getString('cert_assinante_nome'),
          cert_assinante_cargo: c.getString('cert_assinante_cargo'),
          cert_cidade: c.getString('cert_cidade'),
          partes: partes,
          modulos: modulos,
        })
      }
    } catch (err) {
      console.log('[ead] admin/conteudo falhou: ' + err.message)
      return e.json(500, {
        codigo: 'lista_falhou',
        mensagem: 'Não foi possível carregar o conteúdo: ' + err.message,
      })
    }

    return e.json(200, { total: cursos.length, cursos: cursos })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/modulo — cria ou edita um módulo
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/modulo',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador edita.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    const cursoSlug = texto(corpo.curso_slug)
    const titulo = texto(corpo.titulo)
    const ordemPedida = parseInt(texto(corpo.ordem) || '0', 10) || 0

    if (!id && !cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })
    if (!titulo)
      return e.json(400, { codigo: 'titulo_obrigatorio', mensagem: 'Dê um nome ao módulo.' })

    try {
      let mod = null
      if (id) {
        mod = $app.findRecordById('modulos', id)
      } else {
        const curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
        const col = $app.findCollectionByNameOrId('modulos')
        mod = new Record(col)
        mod.set('curso', curso.id)
        // Slug do módulo segue o padrão do curso: fund-m01, fund-m02...
        // Gerado aqui (e não digitado) para não colidir.
        const prefixo = curso.getString('slug').split('-')[0]
        let proximo = 1
        try {
          const existentes = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
            c: curso.id,
          })
          proximo = existentes.length + 1
        } catch (_) {}
        mod.set('slug', prefixo + '-m' + String(proximo).padStart(2, '0'))
      }

      mod.set('titulo', titulo)

      const cursoId = mod.getString('curso')
      let ordem = ordemPedida
      if (ordem <= 0) {
        try {
          const irmaos = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
            c: cursoId,
          })
          let maior = 0
          for (let i = 0; i < irmaos.length; i++) {
            if (irmaos[i].id === mod.id) continue
            const o = irmaos[i].getInt('ordem')
            if (o > maior) maior = o
          }
          ordem = maior + 1
        } catch (_) {
          ordem = 1
        }
      } else {
        // Reordenar: quem ocupa a posição pedida cede o lugar. Sem isso o
        // índice único (curso, ordem) recusa o save com erro incompreensível.
        try {
          const irmaos = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
            c: cursoId,
          })
          for (let i = 0; i < irmaos.length; i++) {
            const ir = irmaos[i]
            if (ir.id === mod.id) continue
            if (ir.getInt('ordem') === ordem) {
              ir.set('ordem', ordem + 1000)
              $app.save(ir)
            }
          }
        } catch (_) {}
      }
      mod.set('ordem', ordem)
      $app.save(mod)

      return e.json(200, {
        ok: true,
        id: mod.id,
        slug: mod.getString('slug'),
        ordem: mod.getInt('ordem'),
        mensagem: 'Módulo salvo: ' + titulo,
      })
    } catch (err) {
      console.log('[ead] admin/modulo falhou: ' + err.message)
      return e.json(400, {
        codigo: 'modulo_falhou',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/parte — cria ou edita um capítulo
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/parte',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador edita.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    const cursoSlug = texto(corpo.curso_slug)
    const titulo = texto(corpo.titulo)
    const rotulo = texto(corpo.rotulo)
    const resumo = texto(corpo.resumo)
    const publicado = corpo.publicado === true || corpo.publicado === 'true'

    if (!titulo)
      return e.json(400, { codigo: 'titulo_obrigatorio', mensagem: 'Nomeie o capítulo.' })

    try {
      let parte = null
      if (id) {
        parte = $app.findRecordById('partes', id)
      } else {
        const curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
        const col = $app.findCollectionByNameOrId('partes')
        parte = new Record(col)
        parte.set('curso', curso.id)
        const prefixo = curso.getString('slug').split('-')[0]
        let n = 1
        try {
          const existentes = $app.findRecordsByFilter('partes', 'curso = {:c}', 'ordem', 100, 0, {
            c: curso.id,
          })
          n = existentes.length + 1
        } catch (_) {}
        parte.set('slug', prefixo + '-p' + String(n).padStart(2, '0'))
        // Rótulo humano automático: "Capítulo N". O dono não precisa digitar;
        // se quiser "Parte I" ou outro nome, sobrescreve.
        parte.set('rotulo', 'Capítulo ' + n)
      }

      parte.set('titulo', titulo)
      if (rotulo) parte.set('rotulo', rotulo)
      if (resumo) parte.set('resumo', resumo)
      parte.set('publicado', publicado)

      if (!id) {
        let ordem = 1
        try {
          const existentes = $app.findRecordsByFilter('partes', 'curso = {:c}', 'ordem', 100, 0, {
            c: parte.getString('curso'),
          })
          let maior = 0
          for (let i = 0; i < existentes.length; i++) {
            const o = existentes[i].getInt('ordem')
            if (o > maior) maior = o
          }
          ordem = maior + 1
        } catch (_) {}
        parte.set('ordem', ordem)
      }

      $app.save(parte)
      return e.json(200, {
        ok: true,
        id: parte.id,
        slug: parte.getString('slug'),
        rotulo: parte.getString('rotulo'),
        mensagem: 'Capítulo salvo: ' + (parte.getString('rotulo') || titulo),
      })
    } catch (err) {
      console.log('[ead] admin/parte falhou: ' + err.message)
      return e.json(400, {
        codigo: 'parte_falhou',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/curso/certificado — dados de emissão do certificado
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/curso/certificado',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador edita.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const cursoSlug = texto(corpo.curso_slug)
    if (!cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso) return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não existe.' })

    const ativo = corpo.cert_ativo === true || corpo.cert_ativo === 'true'
    const carga = parseInt(texto(corpo.cert_carga_horas) || '0', 10) || 0

    // Ativar certificado sem assinante ou sem carga geraria um PDF vazio ou
    // sem valor legal. Recusa e explica, em vez de emitir papel inválido.
    if (ativo) {
      if (carga <= 0)
        return e.json(400, {
          codigo: 'carga_obrigatoria',
          mensagem: 'Para ativar, informe a carga horária do certificado.',
        })
      if (!texto(corpo.cert_assinante_nome))
        return e.json(400, {
          codigo: 'assinante_obrigatorio',
          mensagem: 'Para ativar, informe quem assina o certificado.',
        })
    }

    try {
      curso.set('cert_ativo', ativo)
      curso.set('cert_titulo', texto(corpo.cert_titulo))
      curso.set('cert_texto', texto(corpo.cert_texto))
      curso.set('cert_carga_horas', carga)
      curso.set('cert_assinante_nome', texto(corpo.cert_assinante_nome))
      curso.set('cert_assinante_cargo', texto(corpo.cert_assinante_cargo))
      curso.set('cert_cidade', texto(corpo.cert_cidade))
      $app.save(curso)
      return e.json(200, {
        ok: true,
        cert_ativo: ativo,
        mensagem: ativo ? 'Certificado configurado e ativo.' : 'Certificado desativado.',
      })
    } catch (err) {
      console.log('[ead] admin/curso/certificado falhou: ' + err.message)
      return e.json(400, {
        codigo: 'falhou',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/aula — cria ou edita uma aula (e o vídeo dela)
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/aula',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador edita.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    const moduloId = texto(corpo.modulo_id)
    const titulo = texto(corpo.titulo)
    const descricao = texto(corpo.descricao)
    const numero = texto(corpo.numero)
    const videoUrl = texto(corpo.video_url)
    const materialUrl = texto(corpo.material_url)
    const pergunta = texto(corpo.pergunta_fixacao)
    const duracaoMin = parseInt(texto(corpo.duracao_min) || '0', 10) || 0
    const publicado = corpo.publicado === true || corpo.publicado === 'true'
    const amostra = corpo.amostra === true || corpo.amostra === 'true'
    const ordemPedida = parseInt(texto(corpo.ordem) || '0', 10) || 0

    if (!id && !moduloId)
      return e.json(400, { codigo: 'modulo_obrigatorio', mensagem: 'Escolha o módulo da aula.' })
    if (!titulo)
      return e.json(400, { codigo: 'titulo_obrigatorio', mensagem: 'Dê um nome à aula.' })

    // ---- extrai o id do vídeo de qualquer formato de link do Bunny ----
    // O dono cola o que o Bunny mostra; o servidor entende. Formatos aceitos:
    //   https://iframe.mediadelivery.net/embed/{lib}/{id}?params
    //   https://player.mediadelivery.net/embed/{lib}/{id}
    //   https://video.bunnycdn.com/play/{lib}/{id}
    //   {id}  (só o id, para quem já tem)
    function extrairVideoId(bruto) {
      const s = String(bruto || '').trim()
      if (!s) return ''
      if (s.indexOf('/') === -1) return s
      const m = s.match(/embed\/\d+\/([A-Za-z0-9-]+)/)
      if (m) return m[1]
      const m2 = s.match(/play\/\d+\/([A-Za-z0-9-]+)/)
      if (m2) return m2[1]
      const m3 = s.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      if (m3) return m3[1]
      return ''
    }

    const videoId = extrairVideoId(videoUrl)
    if (videoUrl && !videoId) {
      return e.json(400, {
        codigo: 'video_invalido',
        mensagem:
          'Não consegui identificar o vídeo nesse link. Cole o link de incorporação do Bunny (iframe.mediadelivery.net/embed/...) ou só o id do vídeo.',
      })
    }

    // ---- publicar exige vídeo (decisão 4 no topo) ----
    if (publicado && !videoId) {
      return e.json(409, {
        codigo: 'publicar_sem_video',
        mensagem:
          'Para publicar, a aula precisa de um vídeo. Cole o link do vídeo ou salve como rascunho.',
      })
    }

    try {
      let aula = null
      if (id) {
        aula = $app.findRecordById('aulas', id)
      } else {
        const modulo = $app.findRecordById('modulos', moduloId)
        const curso = $app.findRecordById('cursos', modulo.getString('curso'))
        const col = $app.findCollectionByNameOrId('aulas')
        aula = new Record(col)
        aula.set('modulo', modulo.id)

        // ---- SLUG ----
        // O número tem que ser a posição da aula NO CURSO, não dentro do
        // módulo. Contar só as aulas do módulo gera `fund-a01` de novo em cada
        // módulo novo — o índice único aceita (slug diferente), mas a rota
        // `/ead/aula/fund-a01` passa a apontar para a aula errada e o
        // `numero` falado no vídeo fica errado. Defeito encontrado no teste de
        // 16/11: o módulo 7 gerou `fund-a01` e `M7.1`.
        const prefixo = curso.getString('slug').split('-')[0]

        // 1) posição no curso inteiro = soma das aulas de todos os módulos
        let aulasNoCurso = 0
        try {
          const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
            c: curso.id,
          })
          for (let i = 0; i < mods.length; i++) {
            if (mods[i].id === modulo.id) continue
            const doMod = $app.findRecordsByFilter('aulas', 'modulo = {:m}', 'ordem', 500, 0, {
              m: mods[i].id,
            })
            aulasNoCurso += doMod ? doMod.length : 0
          }
          const neste = $app.findRecordsByFilter('aulas', 'modulo = {:m}', 'ordem', 500, 0, {
            m: modulo.id,
          })
          aulasNoCurso += neste ? neste.length : 0
        } catch (_) {}
        let seq = aulasNoCurso + 1

        // 2) se o slug já existe (aula criada fora do painel), avança até
        //    achar um livre. Sem isso o save falha no índice único.
        let slug = prefixo + '-a' + String(seq).padStart(2, '0')
        while (true) {
          let existe = null
          try {
            existe = $app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
          } catch (_) {}
          if (!existe) break
          seq++
          slug = prefixo + '-a' + String(seq).padStart(2, '0')
        }
        aula.set('slug', slug)
      }

      aula.set('titulo', titulo)
      if (descricao) aula.set('descricao', descricao)
      if (numero) aula.set('numero', numero)
      if (duracaoMin > 0) aula.set('duracao_seg', duracaoMin * 60)
      if (materialUrl) aula.set('material_url', materialUrl)
      if (pergunta) aula.set('pergunta_fixacao', pergunta)

      // ---- ordem (mesma lógica do módulo, com o índice único em vista) ----
      const modId = aula.getString('modulo')
      let ordem = ordemPedida
      if (ordem <= 0) {
        try {
          const irmaos = $app.findRecordsByFilter('aulas', 'modulo = {:m}', 'ordem', 500, 0, {
            m: modId,
          })
          let maior = 0
          for (let i = 0; i < irmaos.length; i++) {
            if (irmaos[i].id === aula.id) continue
            const o = irmaos[i].getInt('ordem')
            if (o > maior) maior = o
          }
          ordem = maior + 1
        } catch (_) {
          ordem = 1
        }
      } else {
        try {
          const irmaos = $app.findRecordsByFilter('aulas', 'modulo = {:m}', 'ordem', 500, 0, {
            m: modId,
          })
          for (let i = 0; i < irmaos.length; i++) {
            const ir = irmaos[i]
            if (ir.id === aula.id) continue
            if (ir.getInt('ordem') === ordem) {
              ir.set('ordem', ordem + 1000)
              $app.save(ir)
            }
          }
        } catch (_) {}
      }
      aula.set('ordem', ordem)

      if (!numero) {
        // Rótulo FALADO no vídeo: M<ordem do módulo>.<posição da aula no módulo>
        let numMod = 1
        try {
          const mod = $app.findRecordById('modulos', modId)
          numMod = mod.getInt('ordem') || 1
        } catch (_) {}
        aula.set('numero', 'M' + numMod + '.' + ordem)
      }

      aula.set('publicado', publicado)
      aula.set('amostra', amostra)
      $app.save(aula)

      // ---- vídeo em `aulas_midia` (fechada ao cliente; só o servidor lê) ----
      if (videoId) {
        try {
          let midia = null
          try {
            midia = $app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: aula.id })
          } catch (_) {}
          if (!midia) {
            const mcol = $app.findCollectionByNameOrId('aulas_midia')
            midia = new Record(mcol)
            midia.set('aula', aula.id)
          }
          midia.set('provider', 'bunny')
          midia.set('video_id', videoId)
          // 'pronto' porque o dono está colando o link de um vídeo que já
          // existe no Bunny. Se um dia houver upload por API, isto vira
          // 'processando' e o webhook do Bunny muda para 'pronto'.
          midia.set('status', 'pronto')
          $app.save(midia)
        } catch (errMid) {
          console.log('[ead] admin/aula: midia falhou: ' + errMid.message)
          return e.json(400, {
            codigo: 'midia_falhou',
            mensagem: 'A aula foi salva, mas o vídeo não: ' + errMid.message,
          })
        }
      }

      return e.json(200, {
        ok: true,
        id: aula.id,
        slug: aula.getString('slug'),
        numero: aula.getString('numero'),
        ordem: aula.getInt('ordem'),
        video_id: videoId,
        mensagem: 'Aula salva: ' + titulo,
      })
    } catch (err) {
      console.log('[ead] admin/aula falhou: ' + err.message)
      return e.json(400, {
        codigo: 'aula_falhou',
        mensagem: 'Não foi possível salvar: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST /backend/v1/admin/aula/excluir — apaga só se ninguém assistiu
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/aula/excluir',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador exclui.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}
    const id = texto(corpo.id)
    if (!id) return e.json(400, { codigo: 'id_obrigatorio', mensagem: 'Aula não informada.' })

    let aula = null
    try {
      aula = $app.findRecordById('aulas', id)
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não existe.' })

    // Já tem aluno que assistiu? Não apaga: despublica.
    // Apagar levaria junto o progresso (cascade) de quem estudou.
    let assistiram = 0
    try {
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'aula = {:a} && concluida = true',
        '',
        50,
        0,
        { a: aula.id },
      )
      assistiram = prog ? prog.length : 0
    } catch (_) {}

    if (assistiram > 0) {
      aula.set('publicado', false)
      try {
        $app.save(aula)
      } catch (err2) {
        return e.json(400, { codigo: 'falhou', mensagem: err2.message })
      }
      return e.json(200, {
        ok: true,
        apenas_despublicada: true,
        mensagem:
          'Esta aula já tem ' +
          assistiram +
          ' aluno(s) que assistiram. Ela foi DESPUBLICADA em vez de apagada, para não perder o histórico deles.',
      })
    }

    try {
      try {
        const mid = $app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: aula.id })
        if (mid) $app.delete(mid)
      } catch (_) {}
      $app.delete(aula)
    } catch (err3) {
      return e.json(400, { codigo: 'falhou', mensagem: 'Não foi possível apagar: ' + err3.message })
    }

    return e.json(200, { ok: true, mensagem: 'Aula excluída.' })
  },
  $apis.requireAuth(),
)
