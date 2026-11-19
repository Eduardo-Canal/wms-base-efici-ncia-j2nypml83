// ead-prediagnostico.pb.js — GET e POST /backend/v1/ead/prediagnostico
//
// LOTE 2, item 6: o pré-diagnóstico é o produto do curso — o resumo que vira
// conversa com a Zion.
//
// MONTAGEM POR REGRAS, SEM IA (pedido explícito): tudo sai de dado que já existe
// (diagnóstico, catálogo de dores, vínculos aula↔dor, progresso e as tabelas de
// texto em ead_config). IA aqui seria uma caixa-preta no meio de uma decisão
// comercial, e o dono não conseguiria explicar ao lead de onde veio o texto.
//
// QUANDO PERMITE: curso 100% concluído E diagnóstico respondido. Antes disso o
// pré-diagnóstico seria chute — ele usa "o aluno já concluiu esta aula" para
// decidir o que destacar.
//
// O CÓDIGO (PD-XXXX) NÃO MUDA ao regravar: o lead pode já ter mandado no
// WhatsApp, e o atendimento abre o caso por ele.

routerAdd(
  'GET',
  '/backend/v1/ead/prediagnostico',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    // ATENÇÃO: `e.request.query()` NÃO existe neste runtime. O acessor correto
    // é `e.request.url.query()`.
    let slug = ''
    try {
      slug = texto(e.request.url.query().get('curso'))
    } catch (_) {}
    if (!slug) return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    let pd = null
    try {
      pd = $app.findFirstRecordByFilter('prediagnosticos', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}

    if (!pd) return e.json(200, { existe: false, curso: slug })

    let snap = null
    try {
      snap = pd.get('snapshot') || null
    } catch (_) {}

    return e.json(200, {
      existe: true,
      curso: slug,
      prediagnostico: {
        codigo: texto(pd.getString('codigo')),
        momento: texto(pd.getString('momento')),
        prazo: texto(pd.getString('prazo')),
        nivel: pd.getInt('nivel'),
        snapshot: snap,
        enviar_anotacoes: pd.getBool('enviar_anotacoes'),
        aprofundamento_em: texto(pd.getString('aprofundamento_em')),
      },
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST — monta/atualiza o pré-diagnóstico
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ead/prediagnostico',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const slug = texto(corpo.curso)
    const momento = texto(corpo.momento)
    const prazo = texto(corpo.prazo)

    const momentosOk = ['estudando', 'avaliando', 'projeto_aprovado', 'tem_wms']
    const prazosOk = ['ate_3m', 'de_3a6m', 'de_6a12m', 'sem_prazo']
    if (momentosOk.indexOf(momento) === -1)
      return e.json(400, { codigo: 'momento_invalido', mensagem: 'Escolha o momento.' })
    if (prazosOk.indexOf(prazo) === -1)
      return e.json(400, { codigo: 'prazo_invalido', mensagem: 'Escolha o prazo.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // ---- diagnóstico respondido? ----
    let diag = null
    try {
      diag = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}
    if (!diag)
      return e.json(409, {
        codigo: 'diagnostico_pendente',
        mensagem: 'Responda o diagnóstico antes de montar o pré-diagnóstico.',
      })

    // ---- curso 100% concluído? ----
    const aulasPub = []
    let aulasConcluidas = {}
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
        for (let k = 0; k < as.length; k++) {
          aulasPub.push({
            id: as[k].id,
            slug: as[k].getString('slug'),
            titulo: as[k].getString('titulo'),
            numero: as[k].getString('numero'),
            ordem: as[k].getInt('ordem'),
          })
        }
      }
    } catch (_) {}

    try {
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'user = {:u} && concluida = true',
        '',
        2000,
        0,
        { u: auth.id },
      )
      for (let i = 0; i < prog.length; i++) aulasConcluidas[prog[i].getString('aula')] = true
    } catch (_) {}

    let feitas = 0
    for (let i = 0; i < aulasPub.length; i++) if (aulasConcluidas[aulasPub[i].id]) feitas++

    if (aulasPub.length === 0 || feitas < aulasPub.length)
      return e.json(409, {
        codigo: 'curso_incompleto',
        mensagem:
          'O pré-diagnóstico sai quando o curso estiver concluído. Faltam ' +
          (aulasPub.length - feitas) +
          ' aula(s).',
        total: aulasPub.length,
        concluidas: feitas,
      })

    // ---- texto de config ----
    let cfg = null
    try {
      cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    } catch (_) {}

    let maturidade = {}
    let textosNivel = {}
    let proximosPassos = {}
    try {
      maturidade = cfg ? cfg.get('maturidade_por_controle') || {} : {}
    } catch (_) {}
    try {
      textosNivel = cfg ? cfg.get('textos_maturidade') || {} : {}
    } catch (_) {}
    try {
      proximosPassos = cfg ? cfg.get('proximo_passo_por_momento') || {} : {}
    } catch (_) {}

    // ---- nível: maturidade do controle atual (1 a 5) ----
    const controle = texto(diag.getString('controle_atual'))
    const nivel = parseInt(maturidade[controle] || 0, 10) || 0
    const textoNivel = texto(textosNivel[String(nivel)] || '')

    // ---- pontos de atenção: um por dor declarada ----
    const pontos = []
    const doresIds = diag.getStringSlice('dores') || []
    for (let i = 0; i < doresIds.length; i++) {
      const dorId = String(doresIds[i])
      let dor = null
      try {
        dor = $app.findRecordById('dores', dorId)
      } catch (_) {}
      if (!dor) continue

      // Aula base: a porta de entrada do curso; sem porta, a de menor ordem.
      let aulaBase = null
      let ehPorta = false
      try {
        const vinculos = $app.findRecordsByFilter('aula_dores', 'dor = {:d}', '', 500, 0, {
          d: dorId,
        })
        let melhor = null
        for (let k = 0; k < vinculos.length; k++) {
          const aulaId = String(vinculos[k].getString('aula') || '')
          let aulaDoCurso = null
          for (let z = 0; z < aulasPub.length; z++) {
            if (aulasPub[z].id === aulaId) {
              aulaDoCurso = aulasPub[z]
              break
            }
          }
          if (!aulaDoCurso) continue
          const porta = vinculos[k].getBool('porta_entrada')
          if (porta) {
            melhor = aulaDoCurso
            ehPorta = true
            break
          }
          if (!melhor || aulaDoCurso.ordem < melhor.ordem) melhor = aulaDoCurso
        }
        aulaBase = melhor
      } catch (_) {}

      pontos.push({
        dor: dor.getString('nome'),
        // Texto em branco: devolve só o nome (o seed cria sem texto).
        texto: texto(dor.getString('texto_prediagnostico')),
        aula_base: aulaBase
          ? {
              slug: aulaBase.slug,
              titulo: aulaBase.titulo,
              numero: aulaBase.numero,
              porta_entrada: ehPorta,
              concluida: !!aulasConcluidas[aulaBase.id],
            }
          : null,
      })
    }

    // ---- snapshot: tudo o que o aluno viu ----
    const snapshot = {
      perfil: {
        tipo_operacao: texto(diag.getString('tipo_operacao')),
        controle_atual: controle,
        papel: texto(diag.getString('papel')),
        porte: texto(diag.getString('porte')),
        dores: doresIds,
      },
      nivel: { valor: nivel, texto: textoNivel },
      pontos_de_atencao: pontos,
      proximo_passo: texto(proximosPassos[momento] || ''),
      momento: momento,
      prazo: prazo,
      montado_em: new Date().toISOString(),
    }

    // ---- grava (mantém o código se já existe) ----
    let pd = null
    try {
      pd = $app.findFirstRecordByFilter('prediagnosticos', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}

    function gerarCodigo() {
      const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      return 'PD-' + String($security.randomStringWithAlphabet(4, alfa))
    }

    try {
      if (!pd) {
        const col = $app.findCollectionByNameOrId('prediagnosticos')
        pd = new Record(col)
        pd.set('user', auth.id)
        pd.set('curso', curso.id)

        let codigo = gerarCodigo()
        let tentativas = 0
        while (tentativas < 20) {
          let existe = null
          try {
            existe = $app.findFirstRecordByFilter('prediagnosticos', 'codigo = {:c}', { c: codigo })
          } catch (_) {}
          if (!existe) break
          codigo = gerarCodigo()
          tentativas++
        }
        pd.set('codigo', codigo)
      }
      pd.set('momento', momento)
      pd.set('prazo', prazo)
      pd.set('nivel', nivel)
      pd.set('snapshot', snapshot)
      $app.save(pd)
    } catch (err) {
      console.log('[ead][prediagnostico] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível montar o pré-diagnóstico agora.',
      })
    }

    return e.json(200, {
      ok: true,
      codigo: texto(pd.getString('codigo')),
      momento: momento,
      prazo: prazo,
      nivel: nivel,
      snapshot: snapshot,
    })
  },
  $apis.requireAuth(),
)
