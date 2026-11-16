// progresso-aula.pb.js — MEDIÇÃO de tempo assistido e conclusão automática.
//
//   POST /backend/v1/aula/{slug}/progresso   { segundos, duracao }
//
// DECISÃO DO DONO (16/11 17:03): conclusão AUTOMÁTICA por tempo assistido
// (~90% do vídeo) — opção (a) da recomendação. Padrão de mercado (Insight
// Academy/Panda, EAD Plataforma).
//
// (A rota POST /aula/{slug}/concluir vive em concluir-equipe.pb.js: o Skip
// Cloud exige UM routerAdd por arquivo.)
//
// ── POR QUE MEDIR TEMPO E NÃO POSIÇÃO ─────────────────────────────────────
// `seconds` do player é a POSIÇÃO do playhead. Arrastar a barra para o fim
// põe a posição no final sem ninguém ter assistido — se fosse só isso, o
// certificado continuaria atestando um clique, só com um passo a mais.
// Então a fonte de verdade é `segundos_assistidos`: a soma do tempo REAL de
// reprodução, acumulada entre reports.
//
// ── COMO O FRAUDE É CONTIDO ───────────────────────────────────────────────
// O navegador não é confiável; o que dá para garantir no servidor:
//   1. Cada report só pode somar, no máximo, o tempo de relógio decorrido
//      desde o report anterior (com folga de 5 s para jitter de rede).
//      Reportar 600 s a cada 2 s não acelera nada.
//   2. Se a posição PULOU para frente mais do que o tempo decorrido
//      (seek/arrastar a barra), o excesso NÃO conta: só o tempo de relógio.
//   3. Se a posição voltou para trás (rebobinou), nada é somado.
//   4. A duração vem do cliente mas é LIMITADA pela `duracao_seg` cadastrada
//      na aula e, na falta dela, por um teto de 6 h. Sem isso, um cliente
//      diria "o vídeo tem 1 segundo" e concluiria na hora.
//   5. Concluir exige matrícula ativa — igual antes.
//
// O que NÃO dá para impedir: um script que abra o player e deixe tocando
// sozinho. Isso vale para qualquer LMS — é por isso que o certificado atesta
// "concluiu o curso", e a tela diz isso.
//
// Libs INLINE (require local não funciona no JSVM deste projeto).

routerAdd(
  'POST',
  '/backend/v1/aula/{slug}/progresso',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
    const inteiro = (v) => {
      const n = parseInt(texto(v), 10)
      return isNaN(n) ? 0 : n
    }
    const agoraUnix = () => Math.floor(Date.now() / 1000)

    // Quanto do vídeo precisa ser assistido para concluir.
    // 90% é o padrão de mercado e deixa o aluno pular o encerramento sem
    // travar. Se um dia o dono quiser 100%, muda aqui e só aqui.
    const PERCENTUAL_CONCLUSAO = 90
    // Folga para jitter de rede entre dois reports.
    const FOLGA_SEG = 5
    // Teto absoluto de duração aceita quando a aula não tem duração cadastrada.
    const TETO_DURACAO = 6 * 60 * 60

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })

    const slug = texto(e.request.pathValue('slug'))
    if (!slug) return e.json(400, { codigo: 'slug_obrigatorio', mensagem: 'Aula não informada.' })

    let aula = null
    try {
      aula = $app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

    // ---- matrícula ativa no curso da aula ----
    let cursoId = ''
    try {
      const mod = $app.findRecordById('modulos', aula.getString('modulo'))
      cursoId = mod.getString('curso')
    } catch (_) {}

    const ehEquipe = (() => {
      try {
        if (auth.collection().name === '_superusers') return true
        const p = String(auth.get('papel'))
        return p === 'admin' || p === 'suporte'
      } catch (_) {
        return false
      }
    })()

    let temMatricula = false
    if (cursoId) {
      try {
        const ms = $app.findRecordsByFilter(
          'matriculas',
          "user = {:u} && curso = {:c} && status = 'ativa'",
          '',
          1,
          0,
          { u: auth.id, c: cursoId },
        )
        temMatricula = !!(ms && ms.length)
      } catch (_) {}
    }
    // Amostra (aula aberta) não gera progresso: não há matrícula, e progresso
    // de quem não é aluno polui o relatório.
    if (!temMatricula && !ehEquipe)
      return e.json(403, {
        codigo: 'sem_matricula',
        mensagem: 'Você precisa ter o curso para registrar progresso.',
      })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    let posicao = inteiro(corpo.segundos)
    const duracaoCli = inteiro(corpo.duracao)
    if (posicao < 0) posicao = 0

    // ---- duração confiável ----
    // Cadastro da aula manda. Cliente só é ouvido quando a aula não tem
    // duração (duracao_seg = 0 é o marcador de "não definido" neste projeto).
    const durCadastro = aula.getInt('duracao_seg')
    let duracao = durCadastro
    if (duracao <= 0) duracao = duracaoCli
    if (duracao <= 0) duracao = TETO_DURACAO
    if (duracao > TETO_DURACAO) duracao = TETO_DURACAO

    // ---- linha de progresso ----
    let linha = null
    try {
      linha = $app.findFirstRecordByFilter('progresso_aulas', 'user = {:u} && aula = {:a}', {
        u: auth.id,
        a: aula.id,
      })
    } catch (_) {}

    const agora = agoraUnix()
    let assistidosAntes = 0
    let posicaoAntes = 0
    let ultimoReport = 0
    if (linha) {
      assistidosAntes = linha.getInt('segundos_assistidos')
      posicaoAntes = linha.getInt('posicao_seg')
      const t = linha.getString('ultimo_report_em')
      if (t) {
        const ms = new Date(String(t).replace(' ', 'T')).getTime()
        if (!isNaN(ms)) ultimoReport = Math.floor(ms / 1000)
      }
    }

    // ---- quanto este report pode somar ----
    // Teto = tempo de relógio desde o report anterior (+folga). Primeiro
    // report não soma nada: não há intervalo para medir, e somar a posição
    // inicial daria tempo de graça.
    let teto = 0
    if (ultimoReport > 0) {
      teto = agora - ultimoReport + FOLGA_SEG
      if (teto < 0) teto = 0
      if (teto > 3600) teto = 3600 // aba dormindo/suspensa não vira hora de estudo
    }

    // Avanço de posição real, descontando salto para frente.
    let avancou = posicao - posicaoAntes
    if (avancou < 0) avancou = 0 // rebobinou: não soma
    let ganho = avancou
    if (ganho > teto) ganho = teto

    let assistidos = assistidosAntes + ganho
    if (assistidos > duracao) assistidos = duracao

    // ---- concluiu? ----
    const alvo = Math.floor((duracao * PERCENTUAL_CONCLUSAO) / 100)
    const jaConcluida = linha ? linha.getBool('concluida') : false
    const concluida = jaConcluida || (duracao > 0 && assistidos >= alvo)

    try {
      if (!linha) {
        const col = $app.findCollectionByNameOrId('progresso_aulas')
        linha = new Record(col)
        linha.set('user', auth.id)
        linha.set('aula', aula.id)
      }
      linha.set('posicao_seg', posicao)
      linha.set('segundos_assistidos', assistidos)
      linha.set('duracao_seg', duracao)
      linha.set('ultimo_report_em', new Date().toISOString())
      linha.set('concluida', concluida)
      $app.save(linha)
    } catch (err) {
      console.log('[ead] progresso: falha ao salvar: ' + err.message)
      return e.json(400, {
        codigo: 'progresso_falhou',
        mensagem: 'Não foi possível registrar o progresso: ' + err.message,
      })
    }

    // ---- progresso do curso, para a tela atualizar sem nova chamada ----
    let total = 0
    let feitas = 0
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: cursoId,
      })
      const aulasPub = []
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          500,
          0,
          { m: mods[i].id },
        )
        for (let k = 0; k < as.length; k++) aulasPub.push(as[k].id)
      }
      total = aulasPub.length
      const prog = $app.findRecordsByFilter(
        'progresso_aulas',
        'user = {:u} && concluida = true',
        '',
        1000,
        0,
        { u: auth.id },
      )
      const set = {}
      for (let i = 0; i < prog.length; i++) set[prog[i].getString('aula')] = true
      for (let i = 0; i < aulasPub.length; i++) if (set[aulasPub[i]]) feitas++
    } catch (_) {}

    const restante = alvo - assistidos
    return e.json(200, {
      ok: true,
      assistidos_seg: assistidos,
      duracao_seg: duracao,
      alvo_seg: alvo,
      // Quanto falta para concluir — a tela usa isto para o aviso honesto.
      faltam_seg: restante > 0 ? restante : 0,
      concluida: concluida,
      total: total,
      concluidas: feitas,
      percentual: total > 0 ? Math.round((feitas / total) * 100) : 0,
    })
  },
  $apis.requireAuth(),
)
