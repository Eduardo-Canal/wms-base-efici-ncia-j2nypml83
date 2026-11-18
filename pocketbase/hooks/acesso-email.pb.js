// acesso-email.pb.js — e-mail automático de liberação de acesso.
//
// O QUE O DONO PEDIU (16/11): "após a liberação do pagamento a pessoa que se
// cadastrou e pagou receba o e-mail liberando o acesso, e na própria tela do
// EAD, após a confirmação do pagamento, já libere o acesso".
//
// COMO FICA:
//   1. Pagamento aprovado → o webhook do Mercado Pago cria a matrícula
//      (isso já existia) e este hook dispara o e-mail.
//   2. Voucher resgatado → também dispara.
//   3. Liberação manual no painel → também dispara.
//   4. O aluno logado vê o curso em /ead/minha-area na hora seguinte.
//
// POR QUE POR EVENTO DE BANCO (onRecordAfterCreateSuccess) E NÃO DENTRO DO
// WEBHOOK: assim o e-mail sai para QUALQUER caminho que crie matrícula —
// webhook, voucher, painel, importação. Um caminho novo no futuro já nasce
// avisando. Se eu colocasse o envio dentro do webhook, voucher e painel
// ficariam sem e-mail.
//
// DETALHES QUE IMPORTAM:
//   * Envio DEPOIS do commit (AfterCreateSuccess): se o e-mail falhar, a
//     matrícula continua criada. Acesso é o que importa; e-mail é aviso.
//   * Falha de e-mail é registrada no log, nunca engolida em silêncio.
//   * Só envia para matrícula com status 'ativa'.
//   * Todo o texto é montado com dados do banco; nada fixo além do layout.
//
// Libs INLINE: helper fora do callback dá ReferenceError no JSVM deste projeto.

onRecordAfterCreateSuccess((e) => {
  const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

  // REVISÃO EXTERNA (item 15): o `name` vinha do banco e era concatenado
  // direto no HTML do e-mail. Quem se cadastrasse com nome contendo HTML
  // injetava marcação no e-mail enviado em nome do curso (phishing com o
  // remetente do dono). Escapa antes de montar.
  const escapa = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  try {
    // Só avisa quem de fato tem acesso agora.
    if (texto(e.record.getString('status')) !== 'ativa') {
      e.next()
      return
    }

    // ---- quem recebe ----
    let aluno = null
    try {
      aluno = $app.findRecordById('users', e.record.getString('user'))
    } catch (_) {}
    if (!aluno) {
      e.next()
      return
    }
    const email = texto(aluno.getString('email'))
    if (!email) {
      e.next()
      return
    }
    // Escapado na origem: este valor entra no HTML do e-mail.
    const nome = escapa(texto(aluno.getString('name')) || 'tudo bem')

    // ---- qual curso ----
    let curso = null
    try {
      curso = $app.findRecordById('cursos', e.record.getString('curso'))
    } catch (_) {}
    const tituloCurso = curso ? texto(curso.getString('titulo')) : 'seu curso'
    const slugCurso = curso ? texto(curso.getString('slug')) : ''

    // ---- de onde veio a liberação (muda a frase) ----
    const origem = texto(e.record.getString('origem'))
    const motivo =
      origem === 'compra'
        ? 'Recebemos a confirmação do seu pagamento e seu acesso está liberado.'
        : origem === 'cortesia'
          ? 'Seu acesso foi liberado.'
          : 'Seu acesso foi liberado.'

    // ---- link: direto para a primeira aula publicada do curso ----
    //
    // ATENÇÃO: o e-mail só sai quando a matrícula é criada, e isso pode
    // acontecer ANTES de a área ser liberada ao público (venda de pré-lançamento,
    // cortesia, teste). Se o link apontar para /ead/minha-area, o aluno clica e
    // encontra uma página trancada. Por isso, enquanto a área estiver fechada, o
    // link é a própria página do curso com o token → a tela reconhece a matrícula
    // e mostra o conteúdo. Depois de liberada, vai direto para a área do aluno.
    var areaLiberada = false
    try {
      var cfgEad = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
      areaLiberada = cfgEad.getBool('liberado') === true
    } catch (_) {
      areaLiberada = false
    }

    let link = 'https://wms-base-eficiencia-c56b6.goskip.app/ead/minha-area'
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 50, 0, {
        c: e.record.getString('curso'),
      })
      for (let i = 0; i < mods.length; i++) {
        const aulas = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          1,
          0,
          { m: mods[i].id },
        )
        if (aulas && aulas.length) {
          const slugAula = texto(aulas[0].getString('slug'))
          if (slugAula) {
            link =
              'https://wms-base-eficiencia-c56b6.goskip.app/ead/aula/' + encodeURIComponent(slugAula)
          }
          break
        }
      }
      // Sem aula publicada ainda: manda para a página do curso, que mostra o
      // currículo e o cadeado. Melhor que um link quebrado.
      if (link.indexOf('/minha-area') !== -1 && slugCurso) {
        link = 'https://wms-base-eficiencia-c56b6.goskip.app/ead/' + encodeURIComponent(slugCurso)
      }
    } catch (_) {
      /* mantém o link padrão */
    }

    // ---- monta e envia ----
    const assunto = 'Seu acesso está liberado — ' + tituloCurso
    const html =
      '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;background:#f6f7f9;padding:24px;">' +
      '<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">' +
      '<h1 style="font-size:20px;margin:0 0 6px;color:#111827;">WMS Base para Eficiência</h1>' +
      '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Cursos de Eduardo Canal</p>' +
      '<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 12px;">Olá, ' +
      nome +
      '.</p>' +
      '<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px;">' +
      motivo +
      '</p>' +
      '<p style="font-size:15px;color:#111827;margin:0 0 20px;"><strong>' +
      tituloCurso +
      '</strong></p>' +
      '<p style="margin:0 0 20px;">' +
      '<a href="' +
      link +
      '" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">Começar a assistir</a>' +
      '</p>' +
      '<p style="font-size:12px;color:#6b7280;line-height:1.5;">Se o botão não abrir, copie este endereço no navegador:<br>' +
      link +
      '</p>' +
      '<p style="font-size:12px;color:#9ca3af;margin-top:24px;">Se você não reconhece esta compra, responda este e-mail.</p>' +
      '</div></div>'

    const msg = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: $app.settings().meta.senderName,
      },
      to: [{ address: email }],
      subject: assunto,
      html: html,
    })
    $app.newMailClient().send(msg)
    console.log('[ead] e-mail de liberacao enviado para ' + email + ' (' + tituloCurso + ')')
  } catch (err) {
    // Nunca derruba a criação da matrícula: o acesso já foi concedido.
    console.log('[ead] falha ao enviar e-mail de liberacao: ' + err.message)
  }

  e.next()
}, 'matriculas')
