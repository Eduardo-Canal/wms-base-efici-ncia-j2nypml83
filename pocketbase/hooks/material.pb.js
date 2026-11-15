// GET /backend/v1/aulas/{slug}/material — PDF de apoio por LINK do Google Drive.
// Só entrega o link para quem tem MATRÍCULA ATIVA no curso (amostra não basta:
// a isca entrega o vídeo, não o material).
// O link mora em `material_url`; o aluno recebe um 302 para o Drive.
// Nunca devolvemos o link sem checar: quem checa é o servidor, a tela não decide.
routerAdd(
  'GET',
  '/backend/v1/aulas/{slug}/material',
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

    var acesso = {
      verificar: function (app, aula, auth) {
        var ret = { ok: false, motivo: '', curso: null, tipo: '' }
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
            var ms = app.findRecordsByFilter(
              'matriculas',
              "user = {:u} && curso = {:c} && status = 'ativa'",
              '-created',
              1,
              0,
              { u: auth.id, c: curso.id },
            )
            if (ms && ms.length) {
              var exp = comum.dataUnix(ms[0].getString('expira_em'))
              if (exp === 0 || exp > comum.agoraUnix()) {
                ret.ok = true
                ret.tipo = 'matricula'
                return ret
              }
            }
          } catch (err2) {}
        }
        ret.motivo = auth ? 'sem_matricula' : 'precisa_login'
        return ret
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
        } catch (err3) {
          console.log('[ead] log material: ' + err3.message)
        }
      },
    }

    var app = $app
    var auth = e.requestInfo().auth
    if (!auth)
      return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para baixar o material.' })

    var slug = comum.texto(e.request.pathValue('slug'))
    var aula = null
    try {
      aula = app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
    } catch (err) {}
    if (!aula) return comum.jsonErro(e, 404, 'aula_inexistente', 'Aula não encontrada.')

    var v = acesso.verificar(app, aula, auth)
    // Amostra abre o vídeo, NÃO o PDF: exige matrícula de verdade.
    if (!v.ok || v.tipo !== 'matricula') {
      return e.json(403, {
        codigo: 'sem_matricula',
        mensagem: 'O material é exclusivo de quem tem o curso.',
      })
    }

    var link = comum.texto(aula.getString('material_url'))
    if (!link)
      return e.json(404, {
        codigo: 'sem_material',
        mensagem: 'Esta aula ainda não tem material de apoio.',
      })
    if (link.indexOf('http') !== 0) {
      console.log('[ead] material_url invalido na aula ' + slug)
      return e.json(500, {
        codigo: 'material_invalido',
        mensagem: 'O link do material está mal configurado.',
      })
    }

    acesso.registrarLog(
      app,
      aula.id,
      auth.id,
      e.realIP(),
      e.request.header.get('user-agent'),
      'material',
    )

    // Devolve o link no corpo (a tela usa para abrir em nova aba) — o destino
    // nunca é exposto sem passar por aqui.
    return e.json(200, {
      aula: aula.getString('slug'),
      url: link,
      // aviso lido pela tela, para ninguém achar que é download nosso
      origem: 'google_drive',
    })
  },
  $apis.requireAuth(),
)
