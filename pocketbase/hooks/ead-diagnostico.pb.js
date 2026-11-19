// ead-diagnostico.pb.js
//
//   GET  /backend/v1/ead/diagnostico?curso=<slug>   o diagnóstico do próprio aluno
//   POST /backend/v1/ead/diagnostico                cria/atualiza (upsert)
//
// LOTE 2, item 3: diagnóstico OBRIGATÓRIO antes de assistir.
//
// POR QUE OBRIGATÓRIO E NÃO UM FORMULÁRIO OPCIONAL: é ele que dá ao dono o
// retrato da operação do aluno. Um campo opcional seria preenchido por 5% das
// pessoas; a obrigatoriedade é o que faz o dado existir. A trava fica nas rotas
// de conteúdo (playback e progresso respondem 409), nunca na tela — regra que
// vive só na interface não é regra.
//
// VALE PARA TODO ALUNO: presenteado ou comprador. O pedido é explícito, e faz
// sentido: o diagnóstico é do curso, não da origem do acesso.
//
// O ACEITE DE CONTATO É INDEPENDENTE: as respostas são salvas com ou sem ele.
// Quem não aceita contato continua com acesso ao curso; só não recebe o convite
// para conversar (e o painel respeita isso — ver item 9).

routerAdd(
  'GET',
  '/backend/v1/ead/diagnostico',
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

    let d = null
    try {
      d = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}

    // ---- catálogo de dores ativas (para a tela de edição) ----
    const dores = []
    try {
      const lista = $app.findRecordsByFilter('dores', 'ativo = true', 'ordem', 100, 0)
      for (let i = 0; i < lista.length; i++) {
        dores.push({ id: lista[i].id, nome: lista[i].getString('nome') })
      }
    } catch (_) {}

    if (!d) return e.json(200, { existe: false, curso: slug, dores: dores })

    return e.json(200, {
      existe: true,
      curso: slug,
      diagnostico: {
        tipo_operacao: texto(d.getString('tipo_operacao')),
        controle_atual: texto(d.getString('controle_atual')),
        dores: d.getStringSlice('dores') || [],
        papel: texto(d.getString('papel')),
        porte: texto(d.getString('porte')),
        aceite_contato: d.getBool('aceite_contato'),
        aceite_contato_em: texto(d.getString('aceite_contato_em')),
        aceite_texto_versao: texto(d.getString('aceite_texto_versao')),
      },
      dores: dores,
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// POST — cria ou atualiza o diagnóstico do aluno naquele curso (upsert)
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ead/diagnostico',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const slug = texto(corpo.curso)
    if (!slug) return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })

    // ---- validação das escolhas contra os valores permitidos ----
    const tipoOp = texto(corpo.tipo_operacao)
    const tiposOk = ['3pl', 'armazem_geral', 'cd_proprio', 'ecommerce', 'outro']
    if (tiposOk.indexOf(tipoOp) === -1)
      return e.json(400, { codigo: 'tipo_invalido', mensagem: 'Escolha o tipo de operação.' })

    const controle = texto(corpo.controle_atual)
    const controlesOk = ['planilha', 'erp', 'wms_mercado', 'sistema_proprio', 'implantando']
    if (controlesOk.indexOf(controle) === -1)
      return e.json(400, { codigo: 'controle_invalido', mensagem: 'Escolha o controle atual.' })

    const doresIds = Array.isArray(corpo.dores) ? corpo.dores : []
    if (doresIds.length < 1)
      return e.json(400, { codigo: 'dores_obrigatorias', mensagem: 'Escolha pelo menos uma dor.' })
    if (doresIds.length > 2)
      return e.json(400, { codigo: 'dores_demais', mensagem: 'Escolha no máximo duas dores.' })

    // Confere que cada dor existe e está ATIVA — não aceita id inventado.
    const doresValidas = []
    for (let i = 0; i < doresIds.length; i++) {
      let d = null
      try {
        d = $app.findRecordById('dores', String(doresIds[i]))
      } catch (_) {}
      if (!d || !d.getBool('ativo'))
        return e.json(400, {
          codigo: 'dor_invalida',
          mensagem: 'Uma das dores escolhidas não existe.',
        })
      doresValidas.push(d.id)
    }

    const papel = texto(corpo.papel)
    const papeisOk = ['diretoria', 'gerencia', 'supervisao', 'ti', 'consultoria', 'outro']
    if (papel && papeisOk.indexOf(papel) === -1)
      return e.json(400, { codigo: 'papel_invalido', mensagem: 'Escolha o seu papel.' })

    const porte = texto(corpo.porte)
    const portesOk = ['ate_2mil', 'de_2a10mil', 'de_10a30mil', 'acima_30mil']
    if (porte && portesOk.indexOf(porte) === -1)
      return e.json(400, { codigo: 'porte_invalido', mensagem: 'Escolha o porte.' })

    // ---- upsert ----
    let d = null
    try {
      d = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
        u: auth.id,
        c: curso.id,
      })
    } catch (_) {}

    const novo = !d
    try {
      if (!d) {
        const col = $app.findCollectionByNameOrId('diagnosticos')
        d = new Record(col)
        d.set('user', auth.id)
        d.set('curso', curso.id)
      }
      d.set('tipo_operacao', tipoOp)
      d.set('controle_atual', controle)
      d.set('dores', doresValidas)
      if (papel) d.set('papel', papel)
      if (porte) d.set('porte', porte)

      // Aceite: registra o momento em que foi dado. Se o aluno desmarca,
      // limpa a data — o consentimento vale enquanto estiver marcado.
      const aceite = corpo.aceite_contato === true || corpo.aceite_contato === 'true'
      d.set('aceite_contato', aceite)
      if (aceite) {
        if (!texto(d.getString('aceite_contato_em')))
          d.set('aceite_contato_em', new Date().toISOString())
      } else {
        d.set('aceite_contato_em', '')
      }
      const versao = texto(corpo.aceite_texto_versao)
      if (versao) d.set('aceite_texto_versao', versao.substring(0, 40))

      $app.save(d)
    } catch (err) {
      console.log('[ead][diagnostico] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível salvar o diagnóstico agora.',
      })
    }

    // ---- marco no voucher do aluno, se ele veio de presente ----
    if (novo) {
      try {
        const v = $app.findFirstRecordByFilter(
          'vouchers',
          'email_destino = {:e} && (aberto_em != "" || entrou_em != "")',
          { e: String(auth.getString('email') || '').toLowerCase() },
        )
        if (v && !texto(v.getString('diagnostico_em'))) {
          v.set('diagnostico_em', new Date().toISOString())
          $app.save(v)
        }
      } catch (_) {}
    }

    return e.json(200, { ok: true, novo: novo })
  },
  $apis.requireAuth(),
)
