// vitrine-curso.pb.js — GET /backend/v1/ead/curso/{slug}
//
// O QUE RESOLVE (cenário aprovado, opção ii): visitante e aluno SEM matrícula
// precisam ver a página do curso — módulos, quantidade de aulas, preço — e
// assistir a AULA ISCA. Mas NÃO devem receber o título das aulas pagas: é a
// lista que o aluno comprou.
//
// ── POR QUE UM ENDPOINT E NÃO A COLEÇÃO `aulas` ───────────────────────────
// Regra de linha não tem granularidade de campo: se a linha é visível, TODOS os
// campos vão junto. Não existe "devolve o título mas esconde o slug" numa
// listRule. Então o portão de `aulas` continua fechado ao visitante e a página
// lê esta rota, que monta a resposta CAMPO A CAMPO.
//
// ── O QUE SAI PARA CADA PERFIL ────────────────────────────────────────────
//   equipe / aluno com matrícula ativa: todas as aulas, com slug (pode abrir).
//   visitante / aluno sem matrícula: aula isca com slug; as demais com
//   `liberada: false` e SEM slug — só número, duração e a posição na lista.
//   Mesmo assim o título das pagas não vai: quem monta o cadeado é a tela.
//
// ── POR QUE NÃO MANDEI O TÍTULO DAS PAGAS MESMO COM CADEADO ───────────────
// Porque o título É o conteúdo vendido neste curso ("Aula 10: Buscando a máxima
// performance: ERP x WMS"). Entregar a lista inteira de graça esvazia a compra,
// e é exatamente o que o portão do lote 1 existia para impedir. A tela mostra
// "Aula 10 · 4 min · disponível na íntegra" no lugar.

routerAdd(
  'GET',
  '/backend/v1/ead/curso/{slug}',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const slug = texto(e.request.pathValue('slug'))
    if (!slug) return e.json(400, { codigo: 'slug_obrigatorio', mensagem: 'Informe o curso.' })

    let curso = null
    try {
      curso = $app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slug })
    } catch (_) {}
    if (!curso)
      return e.json(404, { codigo: 'curso_inexistente', mensagem: 'Curso não encontrado.' })
    if (!curso.getBool('publicado'))
      return e.json(404, { codigo: 'curso_nao_publicado', mensagem: 'Curso não encontrado.' })

    // ---- quem pergunta ----
    let auth = null
    try {
      auth = e.requestInfo().auth
    } catch (_) {}

    let equipe = false
    let temMatricula = false
    if (auth) {
      try {
        if (auth.collection().name === '_superusers') equipe = true
        else {
          const papel = String(auth.get('papel'))
          if (papel === 'admin' || papel === 'suporte') equipe = true
        }
      } catch (_) {}
      if (!equipe) {
        try {
          const ms = $app.findRecordsByFilter(
            'matriculas',
            "user = {:u} && curso = {:c} && status = 'ativa'",
            '',
            1,
            0,
            { u: auth.id, c: curso.id },
          )
          temMatricula = !!(ms && ms.length)
        } catch (_) {}
      }
    }
    const veTudo = equipe || temMatricula

    // ---- módulos ----
    const modulos = []
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: curso.id,
      })
      for (let i = 0; i < mods.length; i++) {
        modulos.push({
          id: mods[i].id,
          titulo: mods[i].getString('titulo'),
          ordem: mods[i].getInt('ordem'),
        })
      }
    } catch (err) {
      console.log('[ead][vitrine] modulos: ' + err.message)
    }

    // ---- aulas ----
    const aulas = []
    let totalSeg = 0
    try {
      const as = $app.findRecordsByFilter('aulas', 'publicado = true', 'ordem', 500, 0)
      const idsModulo = {}
      for (let i = 0; i < modulos.length; i++) idsModulo[modulos[i].id] = true

      for (let i = 0; i < as.length; i++) {
        const a = as[i]
        const modId = String(a.getString('modulo') || '')
        // Só as aulas dos módulos DESTE curso (a consulta traz publicado de
        // todos; filtrar no servidor evita vazar aula de outro curso).
        if (!idsModulo[modId]) continue

        const ehAmostra = a.getBool('amostra')
        const abre = veTudo || ehAmostra
        totalSeg += a.getInt('duracao_seg') || 0

        const item = {
          id: a.id,
          modulo: modId,
          numero: a.getString('numero'),
          ordem: a.getInt('ordem'),
          duracao_seg: a.getInt('duracao_seg') || 0,
          amostra: ehAmostra,
          liberada: abre,
        }
        if (abre) {
          item.slug = a.getString('slug')
          item.titulo = a.getString('titulo')
        } else {
          // Sem slug e sem título: é o cadeado. A tela usa `numero` e
          // `duracao_seg` para montar a linha.
          item.titulo = ''
          item.slug = ''
        }
        aulas.push(item)
      }
    } catch (err2) {
      console.log('[ead][vitrine] aulas: ' + err2.message)
    }

    return e.json(200, {
      curso: {
        id: curso.id,
        slug: curso.getString('slug'),
        titulo: curso.getString('titulo'),
        resumo: curso.getString('resumo_1linha'),
        resultado: curso.getString('resultado_esperado'),
        descricao: curso.getString('descricao'),
        carga_min: curso.getInt('carga_min') || 0,
      },
      modulos: modulos,
      aulas: aulas,
      total_aulas: aulas.length,
      total_seg: totalSeg,
      // A tela usa isto para decidir entre "continuar" e "comprar/entrar".
      tem_matricula: temMatricula,
      equipe: equipe,
    })
  },
  // Público de propósito: é a vitrine. O que é pago fica fora da resposta.
)
