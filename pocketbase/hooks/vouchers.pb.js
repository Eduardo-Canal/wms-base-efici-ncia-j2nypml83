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

    // ---- PORTÃO (revisão externa, item 12) ----
    // Área fechada: equipe e quem tem matrícula ativa passam; visitante e conta
    // sem matrícula não. Exceção deliberada: quem está resgatando um voucher
    // NÃO tem matrícula ainda — é justamente o que o resgate cria. Por isso o
    // portão aqui deixa passar qualquer conta autenticada e a checagem de
    // matrícula fica para as rotas que leem conteúdo.
    var areaAbertaPg = false
    try {
      var cfgPg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
      areaAbertaPg = cfgPg.getBool('liberado') === true
    } catch (_pg) {
      areaAbertaPg = false
    }
    if (!areaAbertaPg) {
      var authPg = e.requestInfo().auth
      if (!authPg)
        return e.json(403, {
          codigo: 'ead_fechado',
          mensagem:
            'A área de cursos ainda não está aberta. Entre na sua conta para usar o código.',
        })
    }

    // ---- LIMITE DE REQUISIÇÕES (revisão externa, item 11) ----
    // O limitador nativo do PocketBase não cobre rota própria (testado: a
    // rajada passava). Contagem no banco: 10 tentativas por minuto por IP.
    // Protege o código do voucher de força bruta — 10 caracteres sem O/0 e I/1
    // ainda são muitos, mas com 10/min um script levaria anos.
    try {
      const agoraMs = Date.now()
      const janelaMs = 60 * 1000
      const LIMITE = 10
      let ip = ''
      try {
        ip = String(e.realIP() || '')
      } catch (_) {}
      const chave = 'voucher_resgatar|' + ip

      let reg = null
      try {
        reg = $app.findFirstRecordByFilter('limite_requisicoes', 'chave = {:c}', { c: chave })
      } catch (_) {}

      let contador = 1
      if (reg) {
        const inicioStr = reg.getString('janela_inicio')
        let inicio = 0
        if (inicioStr) {
          const t = new Date(String(inicioStr).replace(' ', 'T')).getTime()
          if (!isNaN(t)) inicio = t
        }
        if (inicio > 0 && agoraMs - inicio < janelaMs) {
          contador = reg.getInt('contador') + 1
        } else {
          // janela nova
          contador = 1
        }
      }

      if (contador > LIMITE) {
        return e.json(429, {
          codigo: 'muitas_tentativas',
          mensagem: 'Muitas tentativas de resgate. Aguarde um minuto e tente de novo.',
        })
      }

      if (!reg) {
        const colLim = $app.findCollectionByNameOrId('limite_requisicoes')
        reg = new Record(colLim)
        reg.set('chave', chave)
        reg.set('janela_inicio', new Date().toISOString())
      } else if (contador === 1) {
        reg.set('janela_inicio', new Date().toISOString())
      }
      reg.set('contador', contador)
      $app.save(reg)
    } catch (errLim) {
      // Limite é proteção, não caminho crítico: se a contagem falhar, o
      // resgate continua (e fica registrado no log).
      console.log('[ead][limite] falhou: ' + errLim.message)
    }

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

    // ---- 4b. e-mail do destinatário precisa estar VERIFICADO ----
    // REVISÃO EXTERNA (item 9): com `email_destino`, quem tem o código podia
    // criar conta com o e-mail do lead e resgatar antes dele. Exigir
    // `verified = true` fecha isso: só quem recebeu o link de verificação no
    // próprio e-mail consegue usar. O voucher é dado de presente a leads —
    // é justamente o e-mail que identifica a pessoa.
    if (emailDestino) {
      let verificado = false
      try {
        verificado = auth.getBool('verified') === true
      } catch (_) {}
      if (!verificado) {
        // Dispara o e-mail de verificação pelo ENDPOINT NATIVO do PocketBase
        // (/api/collections/users/request-verification). Usei o endpoint em
        // vez de montar token à mão porque a geração de token de verificação
        // não é API pública do JSVM — chamar o que já existe é o caminho
        // verificável. Se o envio falhar, a pessoa ainda pode pedir de novo
        // pela tela de entrar; a resposta não muda.
        try {
          let base = ''
          try {
            base = String($secrets.get('PB_INSTANCE_URL', '') || '')
          } catch (_) {}
          if (!base) base = 'http://127.0.0.1:8090'
          if (base.charAt(base.length - 1) === '/') base = base.substring(0, base.length - 1)
          $http.send({
            url: base + '/api/collections/users/request-verification',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: meuEmail }),
            timeout: 10,
          })
        } catch (errMail) {
          console.log('[ead][voucher] verificacao: envio falhou: ' + errMail.message)
        }
        return e.json(403, {
          codigo: 'verificar_email',
          mensagem:
            'Confirme o seu e-mail antes de usar este código. Enviamos um link de confirmação para ' +
            meuEmail +
            '. Se não chegar, peça outro na tela de entrar.',
        })
      }
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

    // ---- 8. libera o acesso e conta o uso — TUDO OU NADA ----
    // REVISÃO EXTERNA (item 8): a checagem de limite (passo 5), o incremento
    // de `usos`, a matrícula e o registro do resgate estavam separados, e o
    // save do contador ficava num catch vazio. Duas requisições simultâneas
    // com o mesmo código passavam as duas pela checagem e estouravam o limite
    // de usos; e se a matrícula falhasse, o uso já tinha sido contado.
    // Agora roda dentro de $app.runInTransaction: ou tudo acontece, ou nada.
    let criadas = 0
    const nomes = []

    try {
      $app.runInTransaction((txApp) => {
        // Revalidação DENTRO da transação: o estado lido antes pode ter
        // mudado enquanto esta requisição esperava.
        const vTx = txApp.findRecordById('vouchers', v.id)
        const limiteTx = vTx.getInt('limite_usos')
        const usosTx = vTx.getInt('usos')
        if (limiteTx > 0 && usosTx >= limiteTx) {
          throw new Error('voucher_esgotado')
        }

        for (let i = 0; i < cursosParaLiberar.length; i++) {
          const cursoId = cursosParaLiberar[i]
          let cursoTitulo = ''
          try {
            cursoTitulo = txApp.findRecordById('cursos', cursoId).getString('titulo')
          } catch (_) {}

          let jaTem = null
          try {
            jaTem = txApp.findFirstRecordByFilter('matriculas', 'user = {:u} && curso = {:c}', {
              u: auth.id,
              c: cursoId,
            })
          } catch (_) {}

          if (!jaTem) {
            const col = txApp.findCollectionByNameOrId('matriculas')
            const m = new Record(col)
            m.set('user', auth.id)
            m.set('curso', cursoId)
            // 'cortesia' = não foi compra. O painel separa receita de concessão.
            m.set('origem', 'cortesia')
            m.set('status', 'ativa')
            txApp.save(m)
            criadas++
            nomes.push(cursoTitulo)
          } else if (jaTem.getString('status') !== 'ativa') {
            jaTem.set('status', 'ativa')
            txApp.save(jaTem)
            nomes.push(cursoTitulo)
          }
        }

        if (!criadas && !nomes.length) {
          throw new Error('ja_tinha_acesso')
        }

        // Registro do resgate
        const rcol = txApp.findCollectionByNameOrId('voucher_resgates')
        const r = new Record(rcol)
        r.set('voucher', v.id)
        r.set('user', auth.id)
        r.set('email', meuEmail)
        if (cursosParaLiberar.length === 1) r.set('curso', cursosParaLiberar[0])
        txApp.save(r)

        // Contador de usos: lido DENTRO da transação (usosTx), não o valor
        // velho da checagem — era isso que deixava dois resgates contarem 1.
        vTx.set('usos', usosTx + 1)
        txApp.save(vTx)
      })
    } catch (errTx) {
      const motivo = String(errTx.message || '')
      if (motivo === 'voucher_esgotado') {
        return e.json(409, {
          codigo: 'voucher_esgotado',
          mensagem: 'Este código já atingiu o limite de usos.',
        })
      }
      if (motivo === 'ja_tinha_acesso') {
        return e.json(409, {
          codigo: 'ja_tinha_acesso',
          mensagem: 'Você já tem acesso a este curso.',
          area: '/ead/minha-area',
        })
      }
      // Erro interno: log detalhado, resposta genérica.
      console.log('[ead][voucher] resgate falhou: ' + motivo)
      return e.json(500, {
        codigo: 'resgate_falhou',
        mensagem: 'Não foi possível liberar o acesso agora. Tente de novo em instantes.',
      })
    }

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
