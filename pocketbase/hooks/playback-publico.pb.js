// GET /backend/v1/aulas/{slug}/playback-publico — a ISCA (R5).
// Abre a aula marcada como amostra SEM login. Endpoint separado do pago para a
// exceção não viver dentro do caminho de quem pagou.
// Material (PDF) NÃO sai por aqui: é o que separa isca de curso grátis.
routerAdd('GET', '/backend/v1/aulas/{slug}/playback-publico', (e) => {
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
    texto: function (v) {
      return v === undefined || v === null ? '' : String(v).trim()
    },
    agoraUnix: function () {
      return Math.floor(Date.now() / 1000)
    },
    dataUnix: function (v) {
      var s = String(v || '').trim()
      if (!s) return 0
      var d = new Date(s.replace(' ', 'T'))
      var t = d.getTime()
      return isNaN(t) ? 0 : Math.floor(t / 1000)
    },
    sha256hex: function (s) {
      return String($security.sha256(String(s)))
    },
  }

  const acesso = {
    verificar: function (app, aula) {
      if (!aula) return { ok: false, motivo: 'aula_inexistente', curso: null, tipo: '' }
      if (!aula.getBool('publicado'))
        return { ok: false, motivo: 'aula_nao_publicada', curso: null, tipo: '' }
      var curso = null
      try {
        var moduloId = aula.getString('modulo')
        var modulo = moduloId ? app.findRecordById('modulos', moduloId) : null
        var cursoId = modulo ? modulo.getString('curso') : ''
        curso = cursoId ? app.findRecordById('cursos', cursoId) : null
      } catch (err) {
        return { ok: false, motivo: 'curso_inexistente', curso: null, tipo: '' }
      }
      if (!curso || !curso.getBool('publicado'))
        return { ok: false, motivo: 'curso_nao_publicado', curso: curso, tipo: '' }
      if (aula.getBool('amostra')) return { ok: true, motivo: '', curso: curso, tipo: 'amostra' }
      return { ok: false, motivo: 'nao_e_amostra', curso: curso, tipo: '' }
    },
    urlBunny: function (videoId, ttlSeg) {
      var lib = comum.segredo('BUNNY_STREAM_LIBRARY_ID')
      var chave = comum.segredo('BUNNY_STREAM_TOKEN_KEY')
      if (!lib || !chave || !videoId) return ''
      var exp = comum.agoraUnix() + ttlSeg
      var token = comum.sha256hex(chave + videoId + exp)
      return (
        'https://player.mediadelivery.net/embed/' +
        encodeURIComponent(lib) +
        '/' +
        encodeURIComponent(videoId) +
        '?token=' +
        token +
        '&expires=' +
        exp
      )
    },
    midia: function (app, aulaId) {
      var m = null
      try {
        m = app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', { a: aulaId })
      } catch (err) {
        return null
      }
      if (!m || m.getString('status') !== 'pronto') return null
      return m
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
        r.set('em', new Date().toISOString())
        r.set('tipo', tipo)
        app.save(r)
      } catch (err2) {
        console.log('[ead] falha ao gravar log_acessos: ' + err2.message)
      }
    },
  }

  var app = $app
  var slug = comum.texto(e.request.pathValue('slug'))
  var aula = null
  try {
    aula = app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
  } catch (err) {}
  if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

  var v = acesso.verificar(app, aula)
  if (!v.ok) return e.json(403, { codigo: v.motivo, mensagem: 'Esta aula não está aberta.' })

  var midia = acesso.midia(app, aula.id)
  if (!midia) return e.json(409, { codigo: 'video_indisponivel', mensagem: 'Aula em produção.' })

  var url = acesso.urlBunny(midia.getString('video_id'), 600)
  if (!url)
    return e.json(503, {
      codigo: 'player_nao_configurado',
      mensagem: 'Vídeo indisponível no momento.',
    })

  acesso.registrarLog(app, aula.id, '', e.realIP(), e.request.header.get('user-agent'), 'amostra')

  return e.json(200, {
    aula: aula.getString('slug'),
    numero: aula.getString('numero'),
    titulo: aula.getString('titulo'),
    pergunta_fixacao: aula.getString('pergunta_fixacao'),
    player: url,
    expira_em: comum.agoraUnix() + 600,
  })
})
