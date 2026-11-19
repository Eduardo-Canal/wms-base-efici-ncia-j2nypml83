// ead-admin-prediagnostico.pb.js — GET /backend/v1/ead/admin/prediagnostico/{codigo}
//
// LOTE 2, item 9 (segunda parte): é o que o atendimento abre quando chega o
// código PD-XXXX no WhatsApp.
//
// O QUE DEVOLVE: o snapshot do pré-diagnóstico, as respostas do diagnóstico e —
// SÓ SE o aluno marcou `enviar_anotacoes` — as respostas do "Para fixar".
//
// POR QUE AS ANOTAÇÕES DEPENDEM DO FLAG: as anotações do "Para fixar" são
// rascunho pessoal do aluno ("responda antes da próxima aula"), não texto
// publicado. Quem pediu aprofundamento escolhe se entrega isso. Sem o flag,
// mandar junto seria usar dado pessoal para finalidade que a pessoa não
// autorizou.

routerAdd(
  'GET',
  '/backend/v1/ead/admin/prediagnostico/{codigo}',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

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

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
    if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

    let pd = null
    try {
      pd = $app.findFirstRecordByFilter('prediagnosticos', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!pd)
      return e.json(404, { codigo: 'inexistente', mensagem: 'Pré-diagnóstico não encontrado.' })

    // ---- aluno e curso ----
    let user = null
    try {
      user = $app.findRecordById('_pb_users_auth_', pd.getString('user'))
    } catch (_) {}
    let curso = null
    try {
      curso = $app.findRecordById('cursos', pd.getString('curso'))
    } catch (_) {}

    let snap = null
    try {
      snap = pd.get('snapshot') || null
    } catch (_) {}

    // ---- diagnóstico ----
    let diagDados = null
    if (user && curso) {
      try {
        const d = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
          u: user.id,
          c: curso.id,
        })
        if (d) {
          const dores = []
          const ids = d.getStringSlice('dores') || []
          for (let i = 0; i < ids.length; i++) {
            try {
              const dd = $app.findRecordById('dores', String(ids[i]))
              dores.push(dd.getString('nome'))
            } catch (_) {}
          }
          diagDados = {
            tipo_operacao: texto(d.getString('tipo_operacao')),
            controle_atual: texto(d.getString('controle_atual')),
            dores: dores,
            papel: texto(d.getString('papel')),
            porte: texto(d.getString('porte')),
            aceite_contato: d.getBool('aceite_contato'),
            aceite_contato_em: texto(d.getString('aceite_contato_em')),
          }
        }
      } catch (_) {}
    }

    // ---- anotações do "Para fixar" (só com autorização do aluno) ----
    let anotacoes = null
    if (pd.getBool('enviar_anotacoes') && user) {
      anotacoes = []
      try {
        const rs = $app.findRecordsByFilter('respostas_fixacao', 'user = {:u}', '', 500, 0, {
          u: user.id,
        })
        for (let i = 0; i < rs.length; i++) {
          let titulo = ''
          let numero = ''
          try {
            const a = $app.findRecordById('aulas', rs[i].getString('aula'))
            titulo = a.getString('titulo')
            numero = a.getString('numero')
          } catch (_) {}
          anotacoes.push({
            aula: titulo,
            numero: numero,
            texto: rs[i].getString('texto'),
          })
        }
      } catch (err) {
        console.log('[ead][admin-prediag] falha ao ler anotacoes: ' + err.message)
      }
    }

    return e.json(200, {
      codigo: texto(pd.getString('codigo')),
      aluno: {
        nome: user ? texto(user.getString('name')) : '',
        email: user ? texto(user.getString('email')) : '',
        empresa: (function () {
          try {
            return texto(user.getString('empresa'))
          } catch (_) {
            return ''
          }
        })(),
      },
      curso: curso ? texto(curso.getString('titulo')) : '',
      momento: texto(pd.getString('momento')),
      prazo: texto(pd.getString('prazo')),
      nivel: pd.getInt('nivel'),
      snapshot: snap,
      diagnostico: diagDados,
      // null quando o aluno NÃO autorizou enviar as anotações.
      anotacoes: anotacoes,
      anotacoes_autorizadas: pd.getBool('enviar_anotacoes'),
      aprofundamento_em: texto(pd.getString('aprofundamento_em')),
    })
  },
  $apis.requireAuth(),
)
