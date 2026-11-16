// admin-vouchers.pb.js — o dono GERA e GERENCIA vouchers pelo painel.
//
//   GET  /backend/v1/admin/vouchers        lista com uso e validade
//   POST /backend/v1/admin/voucher         cria um voucher
//   POST /backend/v1/admin/voucher/status  ativa/desativa
//
// O QUE O DONO PEDIU (16/11): "gerar voucher promocional e até de acesso livre,
// para liberar acesso aos funcionários da Zion ou para prospecção".
//
// DECISÕES QUE ESTÃO AQUI:
//   * O CÓDIGO É GERADO PELO SERVIDOR, nunca digitado. Código escolhido à mão
//     costuma ser `PROMO2026`, `ZION` — adivinhável. Gero aleatório de 8
//     caracteres sem O/0 e I/1 (confusão na hora de digitar).
//   * Se o dono insistir num código próprio, ele pode mandar — mas o servidor
//     recusa código com menos de 6 caracteres e recusa duplicado.
//   * `acesso` preso a um e-mail = concessão individual. É o caso "funcionário
//     da Zion": o código não serve para mais ninguém, mesmo vazado.
//   * `livre` sem e-mail e com limite = campanha controlada.
//   * Sempre registra `descricao` para o painel explicar por que aquele
//     código existe (daqui a 3 meses ninguém lembra).
//
// Libs INLINE (require local e helper de topo não funcionam no JSVM).

routerAdd(
  'GET',
  '/backend/v1/admin/vouchers',
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

    const lista = []
    try {
      const vs = $app.findRecordsByFilter('vouchers', "id != ''", '-created', 200, 0)
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i]
        const cursos = v.getStringSlice('cursos') || []
        const nomes = []
        for (let k = 0; k < cursos.length; k++) {
          try {
            nomes.push($app.findRecordById('cursos', cursos[k]).getString('titulo'))
          } catch (_) {}
        }
        lista.push({
          id: v.id,
          codigo: v.getString('codigo'),
          tipo: v.getString('tipo'),
          percentual: v.getInt('percentual'),
          valor_centavos: v.getInt('valor_centavos'),
          limite_usos: v.getInt('limite_usos'),
          usos: v.getInt('usos'),
          validade: v.getString('validade'),
          email_destino: v.getString('email_destino'),
          descricao: v.getString('descricao'),
          ativo: v.getBool('ativo'),
          cursos_titulos: nomes,
        })
      }
    } catch (err) {
      return e.json(500, {
        codigo: 'lista_falhou',
        mensagem: 'Não foi possível listar: ' + err.message,
      })
    }

    return e.json(200, { total: lista.length, vouchers: lista })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admin/voucher',
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
      return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador cria voucher.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const tipo = texto(corpo.tipo)
    const tiposOk = ['percentual', 'valor', 'acesso', 'livre']
    if (tiposOk.indexOf(tipo) === -1) {
      return e.json(400, {
        codigo: 'tipo_invalido',
        mensagem: 'Escolha o tipo: percentual, valor, acesso ou livre.',
      })
    }

    // ---- código ----
    let codigo = texto(corpo.codigo).toUpperCase().replace(/[\s-]/g, '')
    if (codigo) {
      if (codigo.length < 6) {
        return e.json(400, {
          codigo: 'codigo_curto',
          mensagem: 'Código precisa ter ao menos 6 caracteres (senão é fácil de adivinhar).',
        })
      }
    } else {
      // Gera sem O/0 e I/1: na hora de digitar, essas letras confundem.
      const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      codigo = ''
      for (let i = 0; i < 8; i++) {
        codigo += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length))
      }
    }

    // Duplicado? Recusa em vez de sobrescrever um voucher que já está circulando.
    try {
      const existe = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: codigo })
      if (existe)
        return e.json(409, {
          codigo: 'codigo_duplicado',
          mensagem: 'Já existe um voucher com este código.',
        })
    } catch (_) {
      /* não existe: pode criar */
    }

    // ---- cursos ----
    const cursoSlugs = corpo.cursos || []
    const cursoIds = []
    if (Array.isArray(cursoSlugs)) {
      for (let i = 0; i < cursoSlugs.length; i++) {
        const s = texto(cursoSlugs[i])
        if (!s) continue
        try {
          cursoIds.push($app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: s }).id)
        } catch (_) {
          return e.json(400, {
            codigo: 'curso_inexistente',
            mensagem: 'Curso não encontrado: ' + s,
          })
        }
      }
    }

    if (tipo === 'acesso' && !cursoIds.length) {
      return e.json(400, {
        codigo: 'curso_obrigatorio',
        mensagem: 'Voucher de acesso precisa dizer qual curso libera.',
      })
    }

    // ---- registro ----
    try {
      const col = $app.findCollectionByNameOrId('vouchers')
      const v = new Record(col)
      v.set('codigo', codigo)
      v.set('tipo', tipo)
      v.set('ativo', true)
      if (cursoIds.length) v.set('cursos', cursoIds)

      if (tipo === 'percentual') {
        const p = parseInt(texto(corpo.percentual) || '0', 10)
        if (!p || p < 1 || p > 100)
          return e.json(400, {
            codigo: 'percentual_invalido',
            mensagem: 'Informe o desconto de 1 a 100 (%).',
          })
        v.set('percentual', p)
      }

      if (tipo === 'valor') {
        const reais = Number(texto(corpo.valor_reais).replace(',', '.'))
        if (isNaN(reais) || reais <= 0)
          return e.json(400, {
            codigo: 'valor_invalido',
            mensagem: 'Informe o valor do desconto em reais, ex.: 50,00.',
          })
        v.set('valor_centavos', Math.round(reais * 100))
      }

      const limite = parseInt(texto(corpo.limite_usos) || '0', 10) || 0
      // `acesso` é sempre 1 uso: é concessão individual. Limite maior viraria
      // um código de campanha com outro nome.
      v.set('limite_usos', tipo === 'acesso' ? 1 : limite)
      v.set('usos', 0)

      const validade = texto(corpo.validade)
      if (validade) v.set('validade', validade)

      const emailDestino = texto(corpo.email_destino).toLowerCase()
      if (emailDestino) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailDestino))
          return e.json(400, { codigo: 'email_invalido', mensagem: 'E-mail inválido.' })
        v.set('email_destino', emailDestino)
      }

      v.set('descricao', texto(corpo.descricao))

      $app.save(v)

      return e.json(200, {
        ok: true,
        id: v.id,
        codigo: codigo,
        mensagem: 'Voucher criado: ' + codigo,
      })
    } catch (err) {
      console.log('[ead] voucher: criacao falhou: ' + err.message)
      return e.json(400, {
        codigo: 'voucher_falhou',
        mensagem: 'Não foi possível criar: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admin/voucher/status',
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

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const id = texto(corpo.id)
    if (!id) return e.json(400, { codigo: 'id_obrigatorio', mensagem: 'Voucher não informado.' })

    let v = null
    try {
      v = $app.findRecordById('vouchers', id)
    } catch (_) {}
    if (!v) return e.json(404, { codigo: 'voucher_inexistente', mensagem: 'Voucher não existe.' })

    // Desativar não apaga: o histórico de resgates continua válido e auditável.
    const ativo = corpo.ativo === true || corpo.ativo === 'true'
    v.set('ativo', ativo)
    try {
      $app.save(v)
    } catch (err) {
      return e.json(400, { codigo: 'falhou', mensagem: err.message })
    }

    return e.json(200, {
      ok: true,
      ativo: ativo,
      mensagem: ativo ? 'Voucher reativado.' : 'Voucher desativado.',
    })
  },
  $apis.requireAuth(),
)
