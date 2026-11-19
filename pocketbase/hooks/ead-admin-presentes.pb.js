// ead-admin-presentes.pb.js — GET /backend/v1/ead/admin/presentes
//
// LOTE 2, item 9: o painel que acompanha a jornada do lead presenteado.
//
// SITUAÇÃO, em ordem de avanço — é o que o dono quer ver de relance:
//   não abriu → abriu → entrou → diagnóstico → aula N de M → concluiu
//
// LGPD (regra explícita do lote): se o lead NÃO marcou aceite_contato E NÃO
// pediu aprofundamento, a rota devolve "sem autorização" no lugar da dor e do
// momento. Pedir aprofundamento vale como autorização para aquele contato —
// é o ato de pedir a conversa.
//
// POR QUE ISSO IMPORTA: "maior dor" e "momento de compra" são dado de negócio
// que o lead pode não querer dividir além do necessário. O curso é dado com
// consentimento do diagnóstico; o painel de prospecção é outra finalidade.

routerAdd(
  'GET',
  '/backend/v1/ead/admin/presentes',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
    const dias = (de, ate) => {
      if (!de) return null
      const a = new Date(String(de).replace(' ', 'T')).getTime()
      if (isNaN(a)) return null
      const b = ate ? new Date(String(ate).replace(' ', 'T')).getTime() : Date.now()
      if (isNaN(b)) return null
      return Math.floor((b - a) / 86400000)
    }

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    const lista = []
    let somaDias = 0
    let comAprofundamento = 0

    try {
      // Só convites pessoais: quem tem nome de lead preenchido.
      const vouchers = $app.findRecordsByFilter('vouchers', "nome_lead != ''", '-created', 500, 0)

      for (let i = 0; i < vouchers.length; i++) {
        const v = vouchers[i]
        const email = texto(v.getString('email_destino')).toLowerCase()

        // curso do convite
        let cursoId = texto(v.getString('curso'))
        if (!cursoId) {
          try {
            const l = v.getStringSlice('cursos') || []
            if (l.length) cursoId = String(l[0])
          } catch (_) {}
        }
        let curso = null
        if (cursoId) {
          try {
            curso = $app.findRecordById('cursos', cursoId)
          } catch (_) {}
        }

        // usuário do lead (pelo e-mail)
        let user = null
        if (email) {
          try {
            user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
          } catch (_) {}
        }

        // diagnóstico: dores e aceite
        let diag = null
        if (user && curso) {
          try {
            diag = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
              u: user.id,
              c: curso.id,
            })
          } catch (_) {}
        }

        // progresso: quantas aulas concluiu
        let concluidas = 0
        let totalAulas = 0
        if (user && curso) {
          try {
            const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, {
              c: curso.id,
            })
            const ids = {}
            for (let m = 0; m < mods.length; m++) {
              const as = $app.findRecordsByFilter(
                'aulas',
                'modulo = {:m} && publicado = true',
                '',
                500,
                0,
                { m: mods[m].id },
              )
              for (let k = 0; k < as.length; k++) ids[as[k].id] = true
              totalAulas += as.length
            }
            const prog = $app.findRecordsByFilter(
              'progresso_aulas',
              'user = {:u} && concluida = true',
              '',
              2000,
              0,
              { u: user.id },
            )
            for (let p = 0; p < prog.length; p++) {
              if (ids[prog[p].getString('aula')]) concluidas++
            }
          } catch (_) {}
        }

        // pré-diagnóstico: momento, prazo, aprofundamento
        let pd = null
        if (user && curso) {
          try {
            pd = $app.findFirstRecordByFilter('prediagnosticos', 'user = {:u} && curso = {:c}', {
              u: user.id,
              c: curso.id,
            })
          } catch (_) {}
        }

        // ---- situação ----
        let situacao = 'nao_abriu'
        if (texto(v.getString('concluiu_em')) || (totalAulas > 0 && concluidas >= totalAulas))
          situacao = 'concluiu'
        else if (concluidas > 0) situacao = 'aula ' + concluidas + ' de ' + totalAulas
        else if (diag) situacao = 'diagnostico'
        else if (texto(v.getString('entrou_em')) || (user && texto(v.getString('entrou_em'))))
          situacao = 'entrou'
        else if (texto(v.getString('aberto_em'))) situacao = 'abriu'

        // ---- LGPD: autorização para mostrar dor e momento ----
        const aceite = diag ? diag.getBool('aceite_contato') : false
        const pediuAprofundar = pd ? !!texto(pd.getString('aprofundamento_em')) : false
        const autorizado = aceite || pediuAprofundar

        // maior dor: a primeira dor do diagnóstico com texto, ou só o nome
        let maiorDor = ''
        if (autorizado && diag) {
          try {
            const ids = diag.getStringSlice('dores') || []
            if (ids.length) {
              const d = $app.findRecordById('dores', String(ids[0]))
              maiorDor = texto(d.getString('nome'))
            }
          } catch (_) {}
        }

        let momento = ''
        let prazo = ''
        if (autorizado && pd) {
          momento = texto(pd.getString('momento'))
          prazo = texto(pd.getString('prazo'))
        }

        // ---- aprofundamento ----
        const aprofEm = pd ? texto(pd.getString('aprofundamento_em')) : ''
        const envioEm = texto(v.getString('created'))
        let diasAteAprofundar = null
        if (aprofEm) {
          diasAteAprofundar = dias(envioEm, aprofEm)
          if (diasAteAprofundar !== null) {
            somaDias += diasAteAprofundar
            comAprofundamento++
          }
        }

        lista.push({
          codigo: texto(v.getString('codigo')),
          nome_lead: texto(v.getString('nome_lead')),
          empresa: texto(v.getString('empresa')),
          enviado_em: envioEm,
          situacao: situacao,
          // Quando não autorizado, a rota NÃO devolve o dado — devolve a marca.
          maior_dor: autorizado ? maiorDor : 'sem autorização',
          momento: autorizado ? momento : 'sem autorização',
          prazo: autorizado ? prazo : 'sem autorização',
          aprofundamento_em: aprofEm,
          dias_desde_envio: dias(envioEm, ''),
          dias_ate_aprofundar: diasAteAprofundar,
          aceite_contato: aceite,
        })
      }
    } catch (err) {
      console.log('[ead][admin-presentes] falha: ' + err.message)
      return e.json(500, {
        codigo: 'lista_falhou',
        mensagem: 'Não foi possível montar a lista de presentes.',
      })
    }

    return e.json(200, {
      total: lista.length,
      presentes: lista,
      // Média de dias entre envio e pedido de aprofundamento (só de quem pediu).
      media_dias_ate_aprofundamento:
        comAprofundamento > 0 ? Math.round((somaDias / comAprofundamento) * 10) / 10 : null,
      com_aprofundamento: comAprofundamento,
    })
  },
  $apis.requireAuth(),
)
