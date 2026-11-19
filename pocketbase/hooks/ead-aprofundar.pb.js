// ead-aprofundar.pb.js — POST /backend/v1/ead/prediagnostico/{codigo}/aprofundar
//
// LOTE 2, item 7: o pedido de conversa com a Zion pelo WhatsApp.
//
// O QUE ESTA ROTA FAZ: registra a intenção (data + se o aluno autoriza enviar as
// anotações), marca o mesmo marco no voucher do aluno (se veio de presente) e
// devolve a URL do WhatsApp já preenchida.
//
// POR QUE O SERVIDOR MONTA A URL: o número e a mensagem vivem em `ead_config`.
// Se a tela montasse, trocar o número exigiria deploy — e o pedido é explícito:
// "trocar o número em ead_config e ver a URL mudar sem novo deploy".
//
// POR QUE 503 QUANDO NÃO HÁ NÚMERO: é falha de configuração, não do aluno. 503
// com mensagem clara diz ao dono o que fazer; 500 genérico esconderia.
//
// POR QUE "SÓ O DONO": o código PD-XXXX é do aluno. Sem essa checagem, qualquer
// pessoa com um código (que pode vazar no WhatsApp) pediria aprofundamento em
// nome de outro e poluiria a fila de atendimento.
//
// PRIVACIDADE: pedir aprofundamento VALE COMO AUTORIZAÇÃO para o contato — é o
// que o painel do item 9 usa para mostrar dor e momento.

routerAdd(
  'POST',
  '/backend/v1/ead/prediagnostico/{codigo}/aprofundar',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase()
    if (!codigo) return e.json(400, { codigo: 'codigo_obrigatorio', mensagem: 'Informe o código.' })

    let pd = null
    try {
      pd = $app.findFirstRecordByFilter('prediagnosticos', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!pd)
      return e.json(404, { codigo: 'codigo_inexistente', mensagem: 'Código não encontrado.' })

    // Só o dono do pré-diagnóstico.
    if (String(pd.getString('user')) !== auth.id)
      return e.json(403, { codigo: 'nao_e_seu', mensagem: 'Este código não é seu.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const enviarAnotacoes = corpo.enviar_anotacoes === true || corpo.enviar_anotacoes === 'true'

    // ---- config: número e mensagem ----
    let cfg = null
    try {
      cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    } catch (_) {}

    let numero = ''
    let modelo = ''
    try {
      numero = texto(cfg.getString('whatsapp_atendimento')).replace(/[^0-9]/g, '')
    } catch (_) {}
    try {
      modelo = texto(cfg.getString('mensagem_whatsapp'))
    } catch (_) {}

    if (!numero)
      return e.json(503, {
        codigo: 'whatsapp_nao_configurado',
        mensagem:
          'O contato por WhatsApp ainda não está configurado. Fale com o suporte pelo e-mail.',
      })

    // ---- dados para os marcadores ----
    let curso = null
    try {
      curso = $app.findRecordById('cursos', pd.getString('curso'))
    } catch (_) {}

    // {empresa}: do voucher (convite) ou do campo opcional em users.
    let empresa = ''
    try {
      empresa = texto(auth.getString('empresa'))
    } catch (_) {}
    if (!empresa) {
      try {
        const email = String(auth.getString('email') || '').toLowerCase()
        const v = $app.findFirstRecordByFilter('vouchers', 'email_destino = {:e}', '', 1, 0, {
          e: email,
        })
        if (v) empresa = texto(v.getString('empresa'))
      } catch (_) {}
    }

    const nome = texto(auth.getString('name')) || 'um aluno'

    // ---- monta a mensagem ----
    // Se o dono apagar o modelo, cai num texto mínimo — nunca sai URL sem texto.
    const base =
      modelo || 'Olá! Sou {nome}, da {empresa}. Concluí o curso {curso} e recebi o código {codigo}.'
    const mensagem = base
      .split('{nome}')
      .join(nome)
      .split('{empresa}')
      .join(empresa || '-')
      .split('{curso}')
      .join(curso ? texto(curso.getString('titulo')) : '')
      .split('{codigo}')
      .join(codigo)

    const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)

    // ---- grava marcos (aprofundamento só na primeira vez) ----
    try {
      if (!texto(pd.getString('aprofundamento_em'))) {
        pd.set('aprofundamento_em', new Date().toISOString())
      }
      pd.set('enviar_anotacoes', enviarAnotacoes)
      $app.save(pd)
    } catch (err) {
      console.log('[ead][aprofundar] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível registrar o pedido agora.',
      })
    }

    // Marco no voucher do aluno, se ele veio de presente.
    try {
      const emailAluno = String(auth.getString('email') || '').toLowerCase()
      if (emailAluno) {
        const vs = $app.findRecordsByFilter('vouchers', 'email_destino = {:e}', '', 5, 0, {
          e: emailAluno,
        })
        for (let i = 0; i < vs.length; i++) {
          if (!texto(vs[i].getString('aprofundamento_em'))) {
            vs[i].set('aprofundamento_em', new Date().toISOString())
            $app.save(vs[i])
          }
        }
      }
    } catch (_) {}

    return e.json(200, { ok: true, url: url })
  },
  $apis.requireAuth(),
)
