// progresso-aula.pb.js — MEDIÇÃO de tempo assistido e conclusão automática.
//
//   POST /backend/v1/aula/{slug}/progresso   { segundos, duracao }
//
// DECISÃO DO DONO (16/11 17:03): conclusão AUTOMÁTICA por tempo assistido
// (~90% do vídeo) — opção (a) da recomendação. Padrão de mercado.
//
// (A rota POST /aula/{slug}/concluir vive em concluir-equipe.pb.js: o Skip
// Cloud exige UM routerAdd por arquivo.)
//
// ── CORREÇÃO DE REVISÃO EXTERNA (18/11, item 2) ────────────────────────────
// DEFEITO QUE EXISTIA: quando a aula tinha `duracao_seg = 0`, o servidor caía
// para a duração enviada pelo NAVEGADOR. Um único POST com `duracao: 1`
// concluía a aula e abria caminho para o certificado. As 20 aulas importadas
// na migration 0020 estão exatamente nesse estado (sem duração).
//
// O QUE MUDOU:
//   1. A duração enviada pelo cliente NUNCA é usada. Fonte única: `duracao_seg`
//      do cadastro da aula. Sem duração cadastrada, a aula grava a POSIÇÃO mas
//      NÃO conclui — e o aluno vê por quê.
//   2. Crédito de tempo por report passou a ser o MENOR entre:
//        a) avanço real da posição,
//        b) tempo de relógio decorrido × 2,
//        c) 60 s.
//      Antes cabiam até 3600 s por intervalo, então um script concluía o curso
//      inteiro em ~1 h sem tocar vídeo.
//   3. Erro interno não devolve `err.message` ao cliente (vai para o log).
//
// ── POR QUE MEDIR TEMPO E NÃO POSIÇÃO ─────────────────────────────────────
// `seconds` do player é a POSIÇÃO do playhead. Arrastar a barra para o fim
// põe a posição no final sem ninguém ter assistido. A fonte de verdade é
// `segundos_assistidos`: soma de tempo REAL de reprodução entre reports.
//
// O que NÃO dá para impedir: um script que abra o player e deixe tocando
// sozinho. Isso vale para qualquer LMS — é por isso que o certificado atesta
// "concluiu o curso".
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
    const PERCENTUAL_CONCLUSAO = 90
    // Teto de crédito por intervalo de report (item 2 da revisão externa).
    const CREDITO_MAX_INTERVALO = 60
    // Multiplicador do relógio: 2x cobre jitter de rede e report atrasado sem
    // abrir espaço para acelerar o curso.
    const FATOR_RELOGIO = 2

    // ---- PORTÃO (revisão externa, item 12) ----
    // Área fechada: equipe e quem tem matrícula ativa passam; visitante e conta
    // sem matrícula não. Antes este arquivo não tinha portão nenhum.
    var areaAbertaPg = false
    try {
      var cfgPg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
      areaAbertaPg = cfgPg.getBool('liberado') === true
    } catch (_pg) {
      areaAbertaPg = false
    }

    const auth = e.requestInfo().auth

    if (!areaAbertaPg) {
      var liberadoPg = false
      try {
        if (auth) {
          if (auth.collection().name === '_superusers') liberadoPg = true
          else {
            var papelPg = String(auth.get('papel'))
            if (papelPg === 'admin' || papelPg === 'suporte') liberadoPg = true
            else {
              var msPg = $app.findRecordsByFilter(
                'matriculas',
                "user = {:u} && status = 'ativa'",
                '',
                1,
                0,
                { u: auth.id },
              )
              if (msPg && msPg.length) liberadoPg = true
            }
          }
        }
      } catch (_pg2) {
        liberadoPg = false
      }
      if (!liberadoPg)
        return e.json(403, {
          codigo: 'ead_fechado',
          mensagem: 'A área de cursos ainda não está aberta.',
        })
    }

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

    // ---- DIAGNÓSTICO OBRIGATÓRIO (lote 2, item 3) ----
    // Sem diagnóstico no curso, nem progresso nem vídeo. A equipe passa, para
    // conseguir testar. A trava é AQUI, no servidor — não na tela.
    if (!ehEquipe && cursoId) {
      let temDiag = false
      try {
        const dd = $app.findFirstRecordByFilter('diagnosticos', 'user = {:u} && curso = {:c}', {
          u: auth.id,
          c: cursoId,
        })
        temDiag = !!dd
      } catch (_) {}
      if (!temDiag)
        return e.json(409, {
          erro: 'diagnostico_pendente',
          codigo: 'diagnostico_pendente',
          mensagem: 'Responda o diagnóstico do curso para começar as aulas.',
        })
    }

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    let posicao = inteiro(corpo.segundos)
    if (posicao < 0) posicao = 0
    // `corpo.duracao` é IGNORADO de propósito: cliente não define duração.

    // ---- duração: só a do cadastro ----
    const duracao = aula.getInt('duracao_seg')
    const temDuracao = duracao > 0

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

    // ---- crédito deste report ----
    // Primeiro report não soma: não há intervalo para medir.
    let ganho = 0
    if (ultimoReport > 0) {
      const decorrido = agora - ultimoReport
      if (decorrido > 0) {
        // (a) avanço real da posição; rebobinar não soma.
        let avancou = posicao - posicaoAntes
        if (avancou < 0) avancou = 0
        // (b) teto pelo relógio do SERVIDOR, com folga.
        const tetoRelogio = decorrido * FATOR_RELOGIO
        // (c) teto absoluto por intervalo.
        ganho = avancou
        if (ganho > tetoRelogio) ganho = tetoRelogio
        if (ganho > CREDITO_MAX_INTERVALO) ganho = CREDITO_MAX_INTERVALO
        if (ganho < 0) ganho = 0
      }
    }

    let assistidos = assistidosAntes + ganho
    if (temDuracao && assistidos > duracao) assistidos = duracao

    // ---- concluiu? ----
    // Sem duração cadastrada NUNCA conclui (item 2 da revisão externa).
    const alvo = temDuracao ? Math.floor((duracao * PERCENTUAL_CONCLUSAO) / 100) : 0
    const jaConcluida = linha ? linha.getBool('concluida') : false
    const concluida = jaConcluida || (temDuracao && alvo > 0 && assistidos >= alvo)

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
      // Erro interno não vaza para o cliente (item de regra do lote).
      console.log('[ead][progresso] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'progresso_falhou',
        mensagem: 'Não foi possível registrar o progresso agora.',
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

    // ---- marco CONCLUIU no convite (lote 2, item 2) ----
    // Só quando o curso inteiro fechou e só na primeira vez. Quem comprou não
    // tem voucher e nada acontece.
    if (total > 0 && feitas === total) {
      try {
        const emailAluno = String(auth.getString('email') || '').toLowerCase()
        if (emailAluno) {
          const vs = $app.findRecordsByFilter('vouchers', 'email_destino = {:e}', '', 5, 0, {
            e: emailAluno,
          })
          for (let i = 0; i < vs.length; i++) {
            if (!String(vs[i].getString('concluiu_em') || '').trim()) {
              vs[i].set('concluiu_em', new Date().toISOString())
              $app.save(vs[i])
            }
          }
        }
      } catch (errC) {
        console.log('[ead][progresso] falha ao marcar concluiu_em: ' + errC.message)
      }
    }

    const restante = alvo - assistidos
    return e.json(200, {
      ok: true,
      assistidos_seg: assistidos,
      duracao_seg: duracao,
      alvo_seg: alvo,
      faltam_seg: restante > 0 ? restante : 0,
      concluida: concluida,
      // Sinaliza à tela que a aula ainda não tem duração cadastrada — sem ela
      // o progresso não conta para conclusão (e o aluno precisa saber).
      duracao_ausente: !temDuracao,
      total: total,
      concluidas: feitas,
      percentual: total > 0 ? Math.round((feitas / total) * 100) : 0,
    })
  },
  $apis.requireAuth(),
)
