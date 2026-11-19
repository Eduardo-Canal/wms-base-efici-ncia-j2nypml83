// ead-entrar-codigo.pb.js — POST /backend/v1/ead/entrar/codigo
//
// LOTE 2, item 1: entrada sem senha por código no e-mail.
//
// FLUXO:
//  1. o visitante informa nome + e-mail;
//  2. se a conta não existe, ela é criada aqui (nome informado, senha aleatória
//     forte que NUNCA é devolvida e ninguém conhece);
//  3. o servidor pede o OTP ao PocketBase e devolve SÓ o otpId;
//  4. o front conclui com authWithOTP(otpId, codigo).
//
// POR QUE A RESPOSTA É IDÊNTICA PARA CONTA NOVA E EXISTENTE:
// se a resposta mudasse, qualquer pessoa poderia descobrir quem tem conta no
// EAD só tentando e-mails. Login por OTP já é conhecido por revelar existência
// pela chegada (ou não) do e-mail; a API não precisa ajudar.
//
// POR QUE A SENHA É ALEATÓRIA E FORTE: a conta precisa de uma senha para
// existir, mas o aluno nunca a usa (e o login por senha é só de admin). Senha
// aleatória de 40 caracteres significa que ninguém entra por senha nessa conta
// até um admin definir uma.
//
// LIMITE (pedido explícito): 5 pedidos por e-mail e 20 por IP a cada hora,
// usando a coleção `limite_requisicoes` do lote 1. Sem isso, a rota vira
// máquina de mandar e-mail para terceiros.

routerAdd(
  'POST',
  '/backend/v1/ead/entrar/codigo',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    // ---- limite: por e-mail e por IP ----
    // A janela é de 1 HORA (diferente do limitador de 60 s do lote 1), então a
    // chave carrega a hora corrente: cada hora é um balde novo, sem precisar de
    // cron de limpeza.
    const agora = new Date()
    const horaChave = agora.toISOString().substring(0, 13) // YYYY-MM-DDTHH
    const msJanela = 60 * 60 * 1000

    const contar = (chave, limite) => {
      let reg = null
      try {
        reg = $app.findFirstRecordByFilter('limite_requisicoes', 'chave = {:c}', { c: chave })
      } catch (_) {}

      let contador = 1
      let inicioMs = 0
      if (reg) {
        const s = reg.getString('janela_inicio')
        if (s) {
          const t = new Date(String(s).replace(' ', 'T')).getTime()
          if (!isNaN(t)) inicioMs = t
        }
        if (inicioMs > 0 && agora.getTime() - inicioMs < msJanela)
          contador = reg.getInt('contador') + 1
        else contador = 1
      }

      const estourou = contador > limite
      if (!estourou) {
        try {
          if (!reg) {
            const col = $app.findCollectionByNameOrId('limite_requisicoes')
            reg = new Record(col)
            reg.set('chave', chave)
            reg.set('janela_inicio', agora.toISOString())
          } else if (contador === 1) {
            reg.set('janela_inicio', agora.toISOString())
          }
          reg.set('contador', contador)
          $app.save(reg)
        } catch (errL) {
          console.log('[ead][entrar] limite: ' + errL.message)
        }
      }
      return estourou
    }

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const nome = texto(corpo.nome).substring(0, 120)
    const email = texto(corpo.email).toLowerCase()

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return e.json(400, { codigo: 'email_invalido', mensagem: 'Informe um e-mail válido.' })
    if (!nome) return e.json(400, { codigo: 'nome_obrigatorio', mensagem: 'Informe o seu nome.' })

    // IP real (o trustedProxy é configurado no lote 1).
    let ip = ''
    try {
      ip = String(e.realIP() || '')
    } catch (_) {}

    if (contar('otp_email|' + email + '|' + horaChave, 5))
      return e.json(429, {
        codigo: 'muitos_codigos_email',
        mensagem: 'Você pediu muitos códigos para este e-mail. Tente de novo daqui a pouco.',
      })
    if (ip && contar('otp_ip|' + ip + '|' + horaChave, 20))
      return e.json(429, {
        codigo: 'muitos_codigos_ip',
        mensagem: 'Muitos pedidos de código deste endereço. Tente de novo daqui a pouco.',
      })

    // ---- acha ou cria a conta ----
    let user = null
    try {
      user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}

    if (!user) {
      try {
        const col = $app.findCollectionByNameOrId('_pb_users_auth_')
        const senha = String($security.randomString(40))
        const u = new Record(col)
        u.set('email', email)
        u.set('name', nome)
        u.set('papel', 'aluno')
        u.set('emailVisibility', false)
        u.set('verified', false)
        u.set('password', senha)
        u.set('passwordConfirm', senha)
        $app.save(u)
        user = u
        // A senha NÃO vai para lugar nenhum: nem log, nem resposta.
      } catch (errC) {
        console.log('[ead][entrar] falha ao criar conta: ' + errC.message)
        return e.json(500, {
          codigo: 'conta_falhou',
          mensagem: 'Não foi possível preparar o seu acesso agora.',
        })
      }
    } else if (!texto(user.getString('name')) && nome) {
      // Conta antiga sem nome: completa com o nome informado agora.
      try {
        user.set('name', nome)
        $app.save(user)
      } catch (_) {}
    }

    // ---- pede o OTP ao PocketBase ----
    // Usa o endpoint NATIVO (a coleção tem otp habilitado pela migration 0054).
    // Não monto token à mão: o formato do OTP e a expiração são do PocketBase.
    let otpId = ''
    try {
      let base = ''
      try {
        base = String($secrets.get('PB_INSTANCE_URL', '') || '')
      } catch (_) {}
      if (!base) base = 'http://127.0.0.1:8090'
      if (base.charAt(base.length - 1) === '/') base = base.substring(0, base.length - 1)

      const r = $http.send({
        url: base + '/api/collections/users/request-otp',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
        timeout: 15,
      })
      if (r && r.statusCode >= 200 && r.statusCode < 300) {
        let d = {}
        try {
          d = JSON.parse(toString(r.body))
        } catch (_) {}
        otpId = String(d.otpId || '')
      } else {
        console.log(
          '[ead][entrar] request-otp HTTP ' +
            (r ? r.statusCode : '?') +
            ': ' +
            (r ? toString(r.body).substring(0, 200) : ''),
        )
      }
    } catch (errO) {
      console.log('[ead][entrar] falha ao pedir OTP: ' + errO.message)
    }

    if (!otpId)
      return e.json(503, {
        codigo: 'codigo_indisponivel',
        mensagem: 'Não foi possível enviar o código agora. Tente de novo em instantes.',
      })

    // Resposta IGUAL para conta nova e existente.
    return e.json(200, { ok: true, otpId: otpId })
  },
  // SEM $apis.requireAuth(): é a porta de entrada. A checagem de limite e a
  // criação da conta acontecem DENTRO do handler.
)
