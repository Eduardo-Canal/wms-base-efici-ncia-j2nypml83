// POST /backend/v1/aulas/{slug}/playback — aula com matrícula ativa.
// Autenticação obrigatória. Devolve URL assinada do Bunny (10 min) e o token do
// PDF. NUNCA devolve video_id. Toda abertura grava log_acessos com hash de IP.
// Libs inlinadas dentro do callback: require local não funciona no Skip.
routerAdd(
  'POST',
  '/backend/v1/aulas/{slug}/playback',
  (e) => {
    const comum = {
      segredo: function (nome) {
        try {
          if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
            var v = $secrets.get(nome, '')
            if (v) return String(v)
          }
        } catch (e1) {}
        try {
          var e2 = $os.getenv(nome)
          return e2 ? String(e2) : ''
        } catch (e3) {
          return ''
        }
      },
      sha256hex: function (s) {
        return String($security.sha256(String(s)))
      },
      agoraUnix: function () {
        return Math.floor(Date.now() / 1000)
      },
      agoraIso: function () {
        return new Date().toISOString()
      },
      dataUnix: function (v) {
        var s = String(v || '').trim()
        if (!s) return 0
        var t = new Date(s.replace(' ', 'T')).getTime()
        return isNaN(t) ? 0 : Math.floor(t / 1000)
      },
      texto: function (v) {
        return v === undefined || v === null ? '' : String(v).trim()
      },
      jsonErro: function (e, status, codigo, mensagem) {
        return e.json(status, { codigo: codigo, mensagem: mensagem })
      },
    }

    const acesso = {
      verificar: function (app, aula, auth) {
        var ret = { ok: false, motivo: '', matricula: null, curso: null, tipo: '' }
        if (!aula) {
          ret.motivo = 'aula_inexistente'
          return ret
        }
        if (!aula.getBool('publicado')) {
          ret.motivo = 'aula_nao_publicada'
          return ret
        }
        var curso = null
        try {
          var moduloId = aula.getString('modulo')
          var modulo = moduloId ? app.findRecordById('modulos', moduloId) : null
          var cursoId = modulo ? modulo.getString('curso') : ''
          curso = cursoId ? app.findRecordById('cursos', cursoId) : null
        } catch (err) {
          ret.motivo = 'curso_inexistente'
          return ret
        }
        ret.curso = curso
        if (!curso || !curso.getBool('publicado')) {
          ret.motivo = 'curso_nao_publicado'
          return ret
        }
        if (auth) {
          try {
            // ATENÇÃO: sort '' e NÃO '-created'. `matriculas` não tem campo
            // `created` (tem `criado_em`), e ordenar por campo inexistente faz
            // a consulta LANÇAR — o catch engolia e quem tinha matrícula era
            // tratado como sem acesso. Bug real, provado em 15/11.
            var ms = app.findRecordsByFilter(
              'matriculas',
              "user = {:u} && curso = {:c} && status = 'ativa'",
              '',
              1,
              0,
              { u: auth.id, c: curso.id },
            )
            if (ms && ms.length) {
              var exp = comum.dataUnix(ms[0].getString('expira_em'))
              if (exp === 0 || exp > comum.agoraUnix()) {
                ret.ok = true
                ret.tipo = 'matricula'
                ret.matricula = ms[0]
                return ret
              }
            }
          } catch (err2) {}
        }
        if (aula.getBool('amostra')) {
          ret.ok = true
          ret.tipo = 'amostra'
          return ret
        }
        ret.motivo = auth ? 'sem_matricula' : 'precisa_login'
        return ret
      },
      midia: function (app, aulaId) {
        try {
          return (
            app.findFirstRecordByFilter('aulas_midia', "aula = {:a} && status = 'pronto'", {
              a: aulaId,
            }) || null
          )
        } catch (err) {
          return null
        }
      },
      urlBunny: function (videoId, ttlSeg) {
        var lib = comum.segredo('BUNNY_STREAM_LIBRARY_ID')
        var chave = comum.segredo('BUNNY_STREAM_TOKEN_KEY')
        if (!lib || !chave) return null
        var exp = comum.agoraUnix() + (ttlSeg || 600)
        var token = comum.sha256hex(chave + videoId + exp)
        return {
          url:
            'https://player.mediadelivery.net/embed/' +
            encodeURIComponent(lib) +
            '/' +
            encodeURIComponent(videoId) +
            '?token=' +
            token +
            '&expires=' +
            exp,
          expira_em: exp,
        }
      },
      registrarLog: function (app, aulaId, userId, ip, ua, tipo) {
        try {
          var col = app.findCollectionByNameOrId('log_acessos')
          var r = new Record(col)
          if (userId) r.set('user', userId)
          r.set('aula', aulaId)
          var sal = comum.segredo('EAD_IP_SALT') || 'ead-sem-sal'
          r.set('ip_hash', comum.sha256hex(sal + '|' + String(ip || '')))
          r.set('user_agent', String(ua || '').substring(0, 300))
          r.set('em', comum.agoraIso())
          r.set('tipo', tipo)
          app.save(r)
        } catch (err) {
          console.log('[ead] log_acessos falhou: ' + err.message)
        }
      },
    }

    var app = $app
    var info = e.requestInfo()
    var auth = info.auth
    if (!auth) return comum.jsonErro(e, 401, 'precisa_login', 'Entre para assistir.')

    var slug = comum.texto(e.request.pathValue('slug'))
    if (!slug) return comum.jsonErro(e, 400, 'slug_obrigatorio', 'Aula não informada.')

    var aula = null
    try {
      aula = app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
    } catch (err) {}
    if (!aula) return comum.jsonErro(e, 404, 'aula_inexistente', 'Aula não encontrada.')

    var v = acesso.verificar(app, aula, auth)
    if (!v.ok) {
      var msg =
        v.motivo === 'sem_matricula'
          ? 'Esta aula faz parte de um curso que você ainda não tem.'
          : 'Aula indisponível.'
      return e.json(403, {
        codigo: v.motivo,
        mensagem: msg,
        curso_slug: v.curso ? v.curso.getString('slug') : '',
      })
    }

    var midia = acesso.midia(app, aula.id)
    if (!midia)
      return e.json(409, { codigo: 'video_indisponivel', mensagem: 'Esta aula está em produção.' })

    var assinada = acesso.urlBunny(midia.getString('video_id'), 600)
    if (!assinada)
      return comum.jsonErro(e, 503, 'video_indisponivel', 'Não foi possível abrir o vídeo agora.')

    acesso.registrarLog(
      app,
      aula.id,
      auth.id,
      e.realIP(),
      e.request.header.get('user-agent'),
      v.tipo,
    )

    return e.json(200, {
      aula: {
        id: aula.id,
        slug: aula.getString('slug'),
        titulo: aula.getString('titulo'),
        numero: aula.getString('numero'),
      },
      player: assinada.url,
      expira_em: assinada.expira_em,
      pergunta_fixacao: aula.getString('pergunta_fixacao'),
      tipo_acesso: v.tipo,
      // Só um sinalizador: o LINK do PDF nunca sai por aqui.
      // Quem entrega é /material, depois de checar matrícula.
      tem_material: String(aula.getString('material_url') || '').trim() !== '',
    })
  },
  $apis.requireAuth(),
)
