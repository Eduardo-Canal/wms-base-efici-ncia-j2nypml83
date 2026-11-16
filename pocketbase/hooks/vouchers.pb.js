// vouchers.pb.js — resgate de voucher pelo aluno.
//
//   POST /backend/v1/voucher/resgatar   { codigo, curso_slug }
//   GET  /backend/v1/voucher/meu        (vouchers que o aluno já usou)
//
// POR QUE O RESGATE É NO SERVIDOR:
// se a tela decidisse "código válido → libera", qualquer um forjaria a resposta
// e ganharia o curso. Aqui TODA a decisão (existe? está ativo? expirou? já
// usou? estourou o limite? é para este e-mail? é para este curso?) acontece
// antes de criar a matrícula.
//
// O QUE ELE **NÃO** FAZ: não dá admin, não mexe em preço, não apaga nada.
// O pior que um código vazado faz é dar acesso ao curso daquele voucher.
//
// A matrícula sai com origem 'cortesia' — assim o painel distingue venda de
// concessão, e o relatório de receita não infla.
//
// Libs INLINE: `require` local não funciona no JSVM deste projeto, e helper
// declarado fora do callback dá ReferenceError (defeito já visto no QA).

routerAdd(
  'POST',
  '/backend/v1/voucher/resgatar',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) {
      return e.json(401, {
        codigo: 'precisa_login',
        mensagem: 'Entre na sua conta para usar o código.',
      })
    }

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    // Código é digitado à mão: normaliza para maiúsculo e sem espaço/acento de
    // teclado. `O`/`0` e `I`/`1` já foram evitados na geração (ver admin).
    const codigo = texto(corpo.codigo).toUpperCase().replace(/[\s-]/g, '')
    const cursoSlug = texto(corpo.curso_slug).toLowerCase()
    if (!codigo) {
      return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Digite o código.' })
    }

    // ---- 1. o voucher existe? ----
    let v = null
    try {
      v = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!v) {
      return e.json(404, {
        codigo: 'voucher_inexistente',
        mensagem: 'Código não encontrado. Confira as letras.',
      })
    }

    if (!v.getBool('ativo')) {
      return e.json(409, {
        codigo: 'voucher_inativo',
        mensagem: 'Este código não está mais válido.',
      })
    }

    // ---- 2. validade ----
    const validade = texto(v.getString('validade'))
    if (validade) {
      const quando = new Date(validade.replace(' ', 'T')).getTime()
      if (!isNaN(quando) && quando < Date.now()) {
        return e.json(409, { codigo: 'voucher_vencido', mensagem: 'Este código expirou.' })
      }
    }

    const tipo = texto(v.getString('tipo'))

    // ---- 3. é desconto? então não libera aqui ----
    if (tipo === 'percentual' || tipo === 'valor') {
      return e.json(409, {
        codigo: 'voucher_de_desconto',
        mensagem:
          'Este código dá desconto. Use-o na tela de compra: o valor final será calculado com o desconto.',
        tipo: tipo,
      })
    }

    // ---- 4. é para este e-mail? ----
    const emailDestino = texto(v.getString('email_destino')).toLowerCase()
    const meuEmail = texto(auth.getString('email')).toLowerCase()
    if (emailDestino && emailDestino !== meuEmail) {
      // Mensagem genérica de propósito: não confirma que o código existe e
      // pertence a outra pessoa.
      return e.json(403, {
        codigo: 'voucher_de_outra_pessoa',
        mensagem: 'Este código foi emitido para outra pessoa.',
      })
    }

    // ---- 5. limite de usos ----
    const limite = v.getInt('limite_usos')
    const usos = v.getInt('usos')
    if (limite > 0 && usos >= limite) {
      return e.json(409, {
        codigo: 'voucher_esgotado',
        mensagem: 'Este código já atingiu o limite de usos.',
      })
    }

    // ---- 6. já resgatou antes? ----
    try {
      const ja = $app.findFirstRecordByFilter('voucher_resgates', 'voucher = {:v} && user = {:u}', {
        v: v.id,
        u: auth.id,
      })
      if (ja) {
        return e.json(409, {
          codigo: 'ja_resgatado',
          mensagem: 'Você já usou este código.',
          area: '/ead/minha-area',
        })
      }
    } catch (_) {
      /* não encontrou: pode resgatar */
    }

    // ---- 7. quais cursos o voucher libera ----
    const cursosDoVoucher = v.getStringSlice('cursos') || []
    const cursosParaLiberar = []

    if (cursosDoVoucher.length) {
      // Voucher preso a curso(s): o slug informado precisa estar na lista.
      for (let i = 0; i < cursosDoVoucher.length; i++) {
        cursosParaLiberar.push(cursosDoVoucher[i])
      }
      if (cursoSlug) {
        let alvo = null
        try {
          alvo = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
        } catch (_) {}
        if (!alvo || cursosDoVoucher.indexOf(alvo.id) === -1) {
          return e.json(400, {
            codigo: 'curso_fora_do_voucher',
            mensagem: 'Este código não vale para este curso.',
          })
        }
        cursosParaLiberar.length = 0
        cursosParaLiberar.push(alvo.id)
      }
    } else {
      // Voucher sem curso: vale para todos os publicados.
      try {
        const todos = $app.findRecordsByFilter('cursos', 'publicado = true', 'ordem', 50, 0)
        for (let i = 0; i < todos.length; i++) cursosParaLiberar.push(todos[i].id)
      } catch (_) {}
    }

    if (!cursosParaLiberar.length) {
      return e.json(409, {
        codigo: 'sem_curso',
        mensagem: 'Este código não está ligado a nenhum curso publicado.',
      })
    }

    // ---- 8. cria a matrícula (sem duplicar) ----
    let criadas = 0
    const nomes = []
    for (let i = 0; i < cursosParaLiberar.length; i++) {
      const cursoId = cursosParaLiberar[i]
      let cursoTitulo = ''
      try {
        cursoTitulo = $app.findRecordById('cursos', cursoId).getString('titulo')
      } catch (_) {}

      let jaTem = null
      try {
        jaTem = $app.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
          u: auth.id,
          c: cursoId,
        })
      } catch (_) {}

      if (!jaTem) {
        try {
          const col = $app.findCollectionByNameOrId('matriculas')
          const m = new Record(col)
          m.set('user', auth.id)
          m.set('curso', cursoId)
          // 'cortesia' = não foi compra. O painel separa receita de concessão.
          m.set('origem', 'cortesia')
          m.set('status', 'ativa')
          $app.save(m)
          criadas++
          nomes.push(cursoTitulo)
        } catch (err) {
          console.log('[ead] voucher: matricula falhou (' + cursoTitulo + '): ' + err.message)
        }
      } else {
        // Já tinha: não é erro, mas também não conta como resgate novo.
        try {
          if (jaTem.getString('status') !== 'ativa') {
            jaTem.set('status', 'ativa')
            $app.save(jaTem)
            nomes.push(cursoTitulo)
          }
        } catch (_) {}
      }
    }

    if (!criadas && !nomes.length) {
      return e.json(409, {
        codigo: 'ja_tinha_acesso',
        mensagem: 'Você já tem acesso a este curso.',
        area: '/ead/minha-area',
      })
    }

    // ---- 9. registra o resgate e conta o uso ----
    try {
      const rcol = $app.findCollectionByNameOrId('voucher_resgates')
      const r = new Record(rcol)
      r.set('voucher', v.id)
      r.set('user', auth.id)
      r.set('email', meuEmail)
      if (cursosParaLiberar.length === 1) r.set('curso', cursosParaLiberar[0])
      $app.save(r)
    } catch (err) {
      console.log('[ead] voucher: resgate nao registrado: ' + err.message)
    }

    v.set('usos', usos + 1)
    try {
      $app.save(v)
    } catch (_) {}

    return e.json(200, {
      ok: true,
      mensagem: nomes.length ? 'Acesso liberado: ' + nomes.join(', ') : 'Acesso liberado.',
      cursos: nomes,
      area: '/ead/minha-area',
    })
  },
  $apis.requireAuth(),
)

// ---------------------------------------------------------------------------
// GET /backend/v1/voucher/meu — o aluno confere o que já resgatou
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/voucher/meu',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const lista = []
    try {
      const rs = $app.findRecordsByFilter('voucher_resgates', 'user = {:u}', '', 50, 0, {
        u: auth.id,
      })
      for (let i = 0; i < rs.length; i++) {
        const r = rs[i]
        let codigo = ''
        let tipo = ''
        try {
          const v = $app.findRecordById('vouchers', r.getString('voucher'))
          codigo = v.getString('codigo')
          tipo = v.getString('tipo')
        } catch (_) {}
        lista.push({ codigo: codigo, tipo: tipo, em: r.getString('created') })
      }
    } catch (err) {
      return e.json(500, { codigo: 'lista_falhou', mensagem: 'Não foi possível listar.' })
    }

    return e.json(200, { total: lista.length, resgates: lista })
  },
  $apis.requireAuth(),
)
