// ead-presente-resgatar.pb.js — POST /backend/v1/ead/presente/:codigo/resgatar
//
// LOTE 2, item 2: o lead transforma o convite em acesso.
//
// O QUE ACONTECE: valida o convite, confere o e-mail (quando `so_este_email`),
// exige `verified`, cria a matrícula, registra em `voucher_resgates` e marca
// `entrou_em`. Repetir a chamada NÃO duplica nada — é idempotente porque o
// índice único (user, curso) em `matriculas` e a checagem de resgate existente
// seguram a repetição.
//
// POR QUE EXIGE verified: com `so_este_email`, o convite vale para um e-mail
// específico. Sem verificação, alguém que descobrisse o código criaria conta com
// o e-mail do lead e resgataria antes dele — o presente ia para o invasor.

routerAdd(
  'POST',
  '/backend/v1/ead/presente/{codigo}/resgatar',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase().replace(/[\s-]/g, '')
    const NAO_ENCONTRADO = {
      codigo: 'convite_indisponivel',
      mensagem: 'Este convite não está disponível.',
    }
    if (!codigo) return e.json(404, NAO_ENCONTRADO)

    // ---- limite por IP (mesmo balde da consulta, 30/min para escrita) ----
    let ip = ''
    try {
      ip = String(e.realIP() || '')
    } catch (_) {}
    try {
      const agoraMs = Date.now()
      const chave = 'presente_resgatar|' + ip
      let reg = null
      try {
        reg = $app.findFirstRecordByFilter('limite_requisicoes', 'chave = {:c}', { c: chave })
      } catch (_) {}
      let contador = 1
      if (reg) {
        const s = reg.getString('janela_inicio')
        let inicio = 0
        if (s) {
          const t = new Date(String(s).replace(' ', 'T')).getTime()
          if (!isNaN(t)) inicio = t
        }
        if (inicio > 0 && agoraMs - inicio < 60000) contador = reg.getInt('contador') + 1
        else contador = 1
      }
      if (contador > 30)
        return e.json(429, {
          codigo: 'muitas_tentativas',
          mensagem: 'Muitas tentativas. Aguarde um minuto.',
        })
      if (!reg) {
        const col = $app.findCollectionByNameOrId('limite_requisicoes')
        reg = new Record(col)
        reg.set('chave', chave)
        reg.set('janela_inicio', new Date().toISOString())
      } else if (contador === 1) {
        reg.set('janela_inicio', new Date().toISOString())
      }
      reg.set('contador', contador)
      $app.save(reg)
    } catch (errL) {
      console.log('[ead][presente] limite resgate: ' + errL.message)
    }

    // ---- convite válido? ----
    let v = null
    try {
      v = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!v || !v.getBool('ativo')) return e.json(404, NAO_ENCONTRADO)

    const validade = texto(v.getString('validade'))
    if (validade) {
      const quando = new Date(validade.replace(' ', 'T')).getTime()
      if (!isNaN(quando) && quando < Date.now()) return e.json(404, NAO_ENCONTRADO)
    }

    // ---- é para este e-mail? (comparação em minúsculas) ----
    const emailDestino = texto(v.getString('email_destino')).toLowerCase()
    const meuEmail = texto(auth.getString('email')).toLowerCase()
    const soEste = v.getBool('so_este_email')

    if (soEste && emailDestino && emailDestino !== meuEmail)
      return e.json(403, {
        codigo: 'convite_de_outra_pessoa',
        mensagem: 'Este convite foi feito para outra pessoa.',
      })

    // Com convite pessoal, o e-mail tem de estar provado.
    if (soEste && !auth.getBool('verified'))
      return e.json(403, {
        codigo: 'verificar_email',
        mensagem:
          'Confirme o seu e-mail antes de abrir o presente. Entre com o código enviado para ' +
          meuEmail +
          '.',
      })

    // ---- curso do convite ----
    let cursoId = texto(v.getString('curso'))
    if (!cursoId) {
      try {
        const lista = v.getStringSlice('cursos') || []
        if (lista.length) cursoId = String(lista[0])
      } catch (_) {}
    }
    if (!cursoId) return e.json(404, NAO_ENCONTRADO)

    let curso = null
    try {
      curso = $app.findRecordById('cursos', cursoId)
    } catch (_) {}
    if (!curso) return e.json(404, NAO_ENCONTRADO)

    // ---- já resgatou por outra pessoa? (convite pessoal é de uso único) ----
    try {
      const rs = $app.findRecordsByFilter('voucher_resgates', 'voucher = {:v}', '', 5, 0, {
        v: v.id,
      })
      if (rs && rs.length) {
        for (let i = 0; i < rs.length; i++) {
          if (String(rs[i].getString('user')) !== auth.id) return e.json(404, NAO_ENCONTRADO)
        }
      }
    } catch (_) {}

    // ---- matrícula + resgate + marcos, tudo ou nada ----
    let jaTinha = false
    try {
      $app.runInTransaction((txApp) => {
        const vTx = txApp.findRecordById('vouchers', v.id)

        // matrícula (idempotente)
        let mat = null
        try {
          mat = txApp.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
            u: auth.id,
            c: cursoId,
          })
        } catch (_) {}

        if (!mat) {
          const mcol = txApp.findCollectionByNameOrId('matriculas')
          mat = new Record(mcol)
          mat.set('user', auth.id)
          mat.set('curso', cursoId)
          mat.set('origem', 'cortesia')
          mat.set('status', 'ativa')
          txApp.save(mat)
        } else {
          jaTinha = true
          if (mat.getString('status') !== 'ativa') {
            mat.set('status', 'ativa')
            txApp.save(mat)
          }
        }

        // resgate (só um registro por voucher+user)
        let resg = null
        try {
          resg = txApp.findFirstRecordByFilter(
            'voucher_resgates',
            'voucher = {:v} && user = {:u}',
            { v: v.id, u: auth.id },
          )
        } catch (_) {}
        if (!resg) {
          const rcol = txApp.findCollectionByNameOrId('voucher_resgates')
          resg = new Record(rcol)
          resg.set('voucher', v.id)
          resg.set('user', auth.id)
          resg.set('email', meuEmail)
          resg.set('curso', cursoId)
          txApp.save(resg)
        }

        // marcos: entrou_em só na primeira vez
        if (!texto(vTx.getString('entrou_em'))) {
          vTx.set('entrou_em', new Date().toISOString())
          txApp.save(vTx)
        }
      })
    } catch (errTx) {
      console.log('[ead][presente] resgate falhou: ' + errTx.message)
      return e.json(500, {
        codigo: 'resgate_falhou',
        mensagem: 'Não foi possível abrir o presente agora. Tente de novo em instantes.',
      })
    }

    // ---- empresa/nome do lead vão para o perfil, se vazios ----
    // Assim {empresa} da mensagem do WhatsApp funciona também para quem veio
    // de presente, sem campo novo na matrícula.
    try {
      let mudou = false
      const empresaV = texto(v.getString('empresa'))
      if (empresaV && !texto(auth.getString('empresa'))) {
        auth.set('empresa', empresaV)
        mudou = true
      }
      if (mudou) $app.save(auth)
    } catch (_) {}

    return e.json(200, {
      ok: true,
      ja_tinha: jaTinha,
      curso: {
        slug: texto(curso.getString('slug')),
        titulo: texto(curso.getString('titulo')),
      },
      mensagem: jaTinha ? 'Você já tem acesso a este curso.' : 'Presente aberto. Bom curso!',
    })
  },
  $apis.requireAuth(),
)
