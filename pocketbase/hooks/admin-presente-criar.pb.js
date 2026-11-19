// admin-presente-criar.pb.js — POST /backend/v1/ead/admin/presente
// v2: reaplicado para o deploy levar o arquivo.
//
// COMANDO 3, ITEM 1: gera o convite pessoal a partir do painel.
//
// POR QUE NÃO CRIAR O VOUCHER PELA API DIRETA DA COLEÇÃO:
//   * `vouchers` tem createRule de admin, então funcionaria — mas o CÓDIGO tem
//     de ser gerado no SERVIDOR, com alfabeto sem O/0 e I/1. Deixar a tela
//     gerar significa aceitar o que ela mandar, e um código previsível derrota
//     o convite pessoal;
//   * o link precisa do domínio do site, que é configuração do servidor
//     (SITE_URL), não do navegador — o admin pode estar no domínio técnico.
//
// SEM E-MAIL AUTOMÁTICO AQUI: o painel oferece "Abrir no WhatsApp" e "Enviar por
// e-mail" para o admin mandar do próprio canal. Mandar pelo relay gastaria a
// cota de 10/hora e o lead receberia de um remetente genérico em vez do Eduardo.

routerAdd(
  'POST',
  '/backend/v1/ead/admin/presente',
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

    const nome = texto(corpo.nome_lead).substring(0, 160)
    const email = texto(corpo.email_destino).toLowerCase()
    const empresa = texto(corpo.empresa).substring(0, 160)
    const whatsapp = texto(corpo.whatsapp_lead)
      .replace(/[^0-9]/g, '')
      .substring(0, 20)
    const cursoSlug = texto(corpo.curso_slug)
    const responsavel = texto(corpo.responsavel)
    const recado = texto(corpo.recado).substring(0, 500)
    const soEste = corpo.so_este_email !== false

    if (!nome)
      return e.json(400, { codigo: 'nome_obrigatorio', mensagem: 'Informe o nome do lead.' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return e.json(400, { codigo: 'email_invalido', mensagem: 'Confira o e-mail do lead.' })
    if (!cursoSlug)
      return e.json(400, { codigo: 'curso_obrigatorio', mensagem: 'Escolha o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: cursoSlug })
    } catch (_) {}
    if (!curso) return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não existe.' })
    if (!curso.getBool('publicado'))
      return e.json(400, {
        codigo: 'curso_nao_publicado',
        mensagem: 'Este curso ainda não está publicado; não dá para presentear.',
      })

    // ---- código: 8 caracteres, sem O/0 e I/1 ----
    // O mesmo alfabeto do voucher de campanha: quem lê por telefone ou copia do
    // papel não tropeça em O vs 0.
    const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let tent = 0; tent < 30; tent++) {
      let c = ''
      for (let i = 0; i < 8; i++) {
        c += alfa.charAt(Math.floor(Math.random() * alfa.length))
      }
      let existe = null
      try {
        existe = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: c })
      } catch (_) {}
      if (!existe) {
        codigo = c
        break
      }
    }
    if (!codigo)
      return e.json(500, {
        codigo: 'codigo_falhou',
        mensagem: 'Não foi possível gerar um código único. Tente de novo.',
      })

    try {
      const col = $app.findCollectionByNameOrId('vouchers')
      const v = new Record(col)
      v.set('codigo', codigo)
      // `acesso` = libera o curso para uma pessoa; não é desconto.
      v.set('tipo', 'acesso')
      v.set('ativo', true)
      v.set('limite_usos', 0)
      v.set('usos', 0)
      v.set('descricao', 'Convite pessoal: ' + nome + (empresa ? ' (' + empresa + ')' : ''))
      v.set('curso', curso.id)
      v.set('email_destino', email)
      v.set('nome_lead', nome)
      v.set('empresa', empresa)
      v.set('whatsapp_lead', whatsapp)
      v.set('recado', recado)
      v.set('so_este_email', soEste)
      if (responsavel) {
        // Só aceita se o id existir: relation com id inválido faz o save falhar
        // com mensagem opaca.
        try {
          $app.findRecordById('_pb_users_auth_', responsavel)
          v.set('responsavel', responsavel)
        } catch (_) {}
      }
      $app.save(v)
    } catch (err) {
      console.log('[ead][presente-criar] falha: ' + err.message)
      return e.json(500, {
        codigo: 'criar_falhou',
        mensagem: 'Não foi possível criar o convite: ' + err.message,
      })
    }

    // ---- link: domínio do site, não do backend ----
    let site = ''
    try {
      site = String($secrets.get('SITE_URL', '') || '')
    } catch (_) {}
    if (!site) site = 'https://wms-base-eficiencia-c56b6.goskip.app'
    if (site.charAt(site.length - 1) === '/') site = site.substring(0, site.length - 1)

    return e.json(200, {
      ok: true,
      codigo: codigo,
      link: site + '/presente/' + codigo,
      curso: { slug: curso.getString('slug'), titulo: curso.getString('titulo') },
    })
  },
  $apis.requireAuth(),
)
