// ead-presente.pb.js — GET /backend/v1/ead/presente/:codigo  (PÚBLICO)
//
// LOTE 2, item 2: a página do convite pessoal.
//
// O QUE ESTA ROTA DEVOLVE (e só isto): nome do lead, e-mail destinado, recado,
// título do curso, capa, número de módulos e de aulas. Nada de preço, nada de
// lista de alunos, nada de id de outro registro. É página de presente, aberta
// por quem recebeu o link — e o link pode ser encaminhado, então o que sai daqui
// tem de valer a pena mesmo se cair em mão errada.
//
// CÓDIGO INEXISTENTE, EXPIRADO OU JÁ USADO POR OUTRA PESSOA: 404 com UMA ÚNICA
// mensagem. Motivo: mensagem específica ("este código expirou", "já foi usado")
// diz a quem tenta que o código existe — vira oráculo para adivinhar convite.
//
// aberto_em: marcado na PRIMEIRA chamada feita por quem NÃO é admin. A prévia do
// admin (o dono conferindo o convite antes de enviar) não conta como abertura —
// senão o painel mentiria sobre a jornada do lead.
//
// LIMITE POR IP usando `limite_requisicoes` (o mesmo do lote 1): sem isso, a
// rota é um enumerador de códigos de convite.

routerAdd(
  'GET',
  '/backend/v1/ead/presente/{codigo}',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    // ---- limite por IP (60 por minuto) ----
    let ip = ''
    try {
      ip = String(e.realIP() || '')
    } catch (_) {}
    try {
      const agoraMs = Date.now()
      const chave = 'presente_get|' + ip
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
      if (contador > 60)
        return e.json(429, {
          codigo: 'muitas_consultas',
          mensagem: 'Muitas consultas em pouco tempo. Aguarde um minuto.',
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
      console.log('[ead][presente] limite: ' + errL.message)
    }

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase().replace(/[\s-]/g, '')
    const NAO_ENCONTRADO = {
      codigo: 'convite_indisponivel',
      mensagem: 'Este convite não está disponível.',
    }

    if (!codigo) return e.json(404, NAO_ENCONTRADO)

    // ---- o voucher existe, está ativo e não expirou? ----
    let v = null
    try {
      v = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!v) return e.json(404, NAO_ENCONTRADO)

    if (!v.getBool('ativo')) return e.json(404, NAO_ENCONTRADO)

    const validade = texto(v.getString('validade'))
    if (validade) {
      const quando = new Date(validade.replace(' ', 'T')).getTime()
      if (!isNaN(quando) && quando < Date.now()) return e.json(404, NAO_ENCONTRADO)
    }

    // "Já usado por outra pessoa": se o convite é pessoal e já tem resgate de
    // OUTRA pessoa, o link não abre mais para um terceiro. Quem já resgatou
    // continua podendo abrir (vê o próprio convite).
    let jaResgatadoPorOutro = false
    try {
      const rs = $app.findRecordsByFilter('voucher_resgates', 'voucher = {:v}', '', 5, 0, {
        v: v.id,
      })
      if (rs && rs.length) {
        let meuId = ''
        try {
          const auth = e.requestInfo().auth
          if (auth) meuId = auth.id
        } catch (_) {}
        for (let i = 0; i < rs.length; i++) {
          if (String(rs[i].getString('user')) !== meuId) jaResgatadoPorOutro = true
          break
        }
      }
    } catch (_) {}

    // Se é "só este e-mail" e já foi resgatado por outra pessoa, o convite
    // acabou. Vouchers de campanha (sem so_este_email) não entram nessa regra.
    const soEste = v.getBool('so_este_email')
    if (soEste && jaResgatadoPorOutro) return e.json(404, NAO_ENCONTRADO)

    // ---- curso do convite ----
    // Preferência: `curso` (singular, do convite pessoal). Se vazio, usa o
    // primeiro de `cursos` (voucher de campanha antigo).
    let cursoId = texto(v.getString('curso'))
    if (!cursoId) {
      try {
        const lista = v.getStringSlice('cursos') || []
        if (lista.length) cursoId = String(lista[0])
      } catch (_) {}
    }

    let curso = null
    if (cursoId) {
      try {
        curso = $app.findRecordById('cursos', cursoId)
      } catch (_) {}
    }
    if (!curso) return e.json(404, NAO_ENCONTRADO)

    // ---- contagem de módulos e aulas (só números) ----
    let modulos = 0
    let aulas = 0
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', '', 200, 0, { c: curso.id })
      modulos = mods.length
      for (let i = 0; i < mods.length; i++) {
        const lista = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          '',
          500,
          0,
          { m: mods[i].id },
        )
        aulas += lista.length
      }
    } catch (_) {}

    // ---- capa: URL absoluta do BACKEND (o domínio do site não roteia /api/files) ----
    let capaUrl = ''
    try {
      const arq = texto(curso.getString('capa'))
      if (arq) {
        let host = ''
        try {
          host = String($secrets.get('EAD_API_PUBLICA', '') || '')
        } catch (_) {}
        if (!host) host = 'https://wms-base-eficiencia-c56b6.shrd01.internal.goskip.dev'
        if (host.charAt(host.length - 1) === '/') host = host.substring(0, host.length - 1)
        capaUrl =
          host +
          '/api/files/' +
          curso.collection().id +
          '/' +
          curso.id +
          '/' +
          encodeURIComponent(arq)
      }
    } catch (_) {}

    // ---- marca aberto_em: só a primeira vez, e só se NÃO for admin ----
    let ehAdmin = false
    try {
      const auth = e.requestInfo().auth
      if (auth) {
        if (auth.collection().name === '_superusers') ehAdmin = true
        else {
          const p = String(auth.get('papel'))
          ehAdmin = p === 'admin' || p === 'suporte'
        }
      }
    } catch (_) {}

    if (!ehAdmin && !texto(v.getString('aberto_em'))) {
      try {
        v.set('aberto_em', new Date().toISOString())
        $app.save(v)
      } catch (errA) {
        // Não falha a página por causa de um marco.
        console.log('[ead][presente] falha ao marcar aberto_em: ' + errA.message)
      }
    }

    return e.json(200, {
      nome_lead: texto(v.getString('nome_lead')),
      email_destino: texto(v.getString('email_destino')),
      recado: texto(v.getString('recado')),
      curso: {
        titulo: texto(curso.getString('titulo')),
        capa: capaUrl,
        modulos: modulos,
        aulas: aulas,
      },
      so_este_email: soEste,
    })
  },
  // SEM requireAuth: a página do convite é pública (o limite por IP é a defesa).
)
