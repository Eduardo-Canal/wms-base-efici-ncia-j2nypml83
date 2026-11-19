// 0056_lote2_seed.js
//
// LOTE 2 — dados iniciais.
//
// 1. As 8 dores (item 4). `texto_prediagnostico` em branco de propósito: o dono
//    preenche pelo painel. Texto em branco aqui NÃO é esquecimento — é o que o
//    pedido definiu, e o pré-diagnóstico trata isso (mostra só o nome).
// 2. Portas de entrada provisórias no curso fund-wms-fundamentos, pela numeração
//    falada das aulas (Aula 01..20). O dono revisa pelo painel.
// 3. Os dois cursos futuros como `em_breve` (item 8).
// 4. Config do pré-diagnóstico e do WhatsApp (itens 6 e 7) — valores
//    provisórios; nenhum telefone inventado (whatsapp fica VAZIO, e o endpoint
//    responde 503 até o dono preencher).

migrate(
  (app) => {
    // ------------------------------------------------------------------
    // 1. dores
    // ------------------------------------------------------------------
    const nomesDores = [
      'Acuracidade de estoque',
      'Produtividade na separação',
      'Fila na portaria e nas docas',
      'Integração ERP x WMS',
      'Faturamento de armazenagem',
      'Rastreabilidade (lote, validade, série)',
      'Visibilidade para o cliente',
      'Implantação de WMS travada',
    ]

    const idPorNome = {}
    for (let i = 0; i < nomesDores.length; i++) {
      let d = null
      try {
        d = app.findFirstRecordByFilter('dores', 'nome = {:n}', { n: nomesDores[i] })
      } catch (_) {}
      if (!d) {
        try {
          const col = app.findCollectionByNameOrId('dores')
          d = new Record(col)
          d.set('nome', nomesDores[i])
          // Em branco: o dono preenche pelo painel.
          d.set('texto_prediagnostico', '')
          d.set('ordem', i + 1)
          d.set('ativo', true)
          app.save(d)
        } catch (err) {
          console.log('[ead][lote2] falha ao criar dor ' + nomesDores[i] + ': ' + err.message)
        }
      }
      if (d) idPorNome[nomesDores[i]] = d.id
    }
    console.log('[ead][lote2] dores: ' + Object.keys(idPorNome).length + ' disponíveis')

    // ------------------------------------------------------------------
    // 2. portas de entrada provisórias (curso fund-wms-fundamentos)
    // ------------------------------------------------------------------
    // Mapa: nome da dor -> número falado da aula (Aula N).
    const mapa = [
      ['Acuracidade de estoque', 7],
      ['Rastreabilidade (lote, validade, série)', 7],
      ['Implantação de WMS travada', 8],
      ['Integração ERP x WMS', 10],
      ['Faturamento de armazenagem', 12],
      ['Visibilidade para o cliente', 14],
      ['Fila na portaria e nas docas', 16],
      ['Produtividade na separação', 18],
    ]

    let curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (_) {}
    if (!curso) {
      console.log('[ead][lote2] curso fund-wms-fundamentos nao existe; seed de portas pulado')
    } else {
      for (let i = 0; i < mapa.length; i++) {
        const nomeDor = mapa[i][0]
        const numero = mapa[i][1]
        const dorId = idPorNome[nomeDor]
        if (!dorId) continue

        // Acha a aula pelo NÚMERO FALADO, não pelo slug: o slug carrega
        // prefixo e descrição, e muda quando o dono renomeia a aula.
        const padrao = 'Aula ' + String(numero).padStart(2, '0')
        let aula = null
        try {
          aula = app.findFirstRecordByFilter('aulas', 'numero = {:n}', { n: padrao })
        } catch (_) {}
        if (!aula) {
          // Tenta pelo formato "Aula N" sem zero (aula 7 em vez de 07).
          try {
            aula = app.findFirstRecordByFilter('aulas', 'numero = {:n}', { n: 'Aula ' + numero })
          } catch (_) {}
        }
        if (!aula) {
          console.log('[ead][lote2] aula "' + padrao + '" nao encontrada; pulando ' + nomeDor)
          continue
        }

        let vinculo = null
        try {
          vinculo = app.findFirstRecordByFilter('aula_dores', 'aula = {:a} && dor = {:d}', {
            a: aula.id,
            d: dorId,
          })
        } catch (_) {}
        if (!vinculo) {
          try {
            const col = app.findCollectionByNameOrId('aula_dores')
            vinculo = new Record(col)
            vinculo.set('aula', aula.id)
            vinculo.set('dor', dorId)
            vinculo.set('porta_entrada', true)
            app.save(vinculo)
          } catch (err) {
            console.log('[ead][lote2] falha em aula_dores (' + nomeDor + '): ' + err.message)
          }
        }
      }
      console.log('[ead][lote2] portas de entrada provisionais aplicadas')
    }

    // ------------------------------------------------------------------
    // 3. cursos futuros em_breve
    // ------------------------------------------------------------------
    const futuros = [
      {
        slug: 'diag-diagnostico-da-operacao',
        titulo: 'Diagnóstico da Operação',
        aulas: 20,
        ordem: 2,
      },
      {
        slug: 'impl-reestruturacao-dos-processos',
        titulo: 'Reestruturação dos Processos',
        aulas: 23,
        ordem: 3,
      },
    ]

    for (let i = 0; i < futuros.length; i++) {
      let c = null
      try {
        c = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: futuros[i].slug })
      } catch (_) {}
      if (!c) {
        try {
          const col = app.findCollectionByNameOrId('cursos')
          c = new Record(col)
          c.set('slug', futuros[i].slug)
          c.set('titulo', futuros[i].titulo)
          c.set('status', 'em_breve')
          c.set('publicado', false)
          c.set('ordem', futuros[i].ordem)
          c.set('aulas_previstas', futuros[i].aulas)
          c.set('carga_min', 120)
          c.set('cert_carga_horas', 2)
          app.save(c)
        } catch (err) {
          console.log('[ead][lote2] falha ao criar curso ' + futuros[i].slug + ': ' + err.message)
        }
      }
    }
    console.log('[ead][lote2] cursos em_breve garantidos')

    // ------------------------------------------------------------------
    // 4. config do pré-diagnóstico (valores provisórios do pedido)
    // ------------------------------------------------------------------
    try {
      const cfg = app.findFirstRecordByFilter('ead_config', "chave = 'principal'")

      // Matriz de maturidade por controle atual (1 a 5).
      const maturidade = {
        planilha: 1,
        erp: 2,
        sistema_proprio: 2,
        implantando: 3,
        wms_mercado: 3,
      }

      // Textos por nível — curtos, sem promessa comercial.
      const textos = {
        1: 'A operação é controlada por planilhas e conhecimento de quem está no dia a dia.',
        2: 'Existe sistema, mas ele não sustenta a rotina sem retrabalho manual.',
        3: 'Há sistema em uso, com pontos cegos que aparecem no fechamento.',
        4: 'O controle é consistente e a operação busca ganho de eficiência.',
        5: 'A operação é medida e integrada de ponta a ponta.',
      }

      // Próximo passo por momento de compra.
      const proximo = {
        estudando: 'Terminar o curso e voltar ao diagnóstico com os números da operação em mãos.',
        avaliando: 'Levantar os números de cada dor antes de decidir por um projeto.',
        projeto_aprovado: 'Alinhar escopo e cronograma com quem vai implantar.',
        tem_wms: 'Revisar a configuração atual antes de trocar de sistema.',
      }

      cfg.set('maturidade_por_controle', maturidade)
      cfg.set('textos_maturidade', textos)
      cfg.set('proximo_passo_por_momento', proximo)
      // WhatsApp VAZIO: não invento número. O endpoint responde 503 até o dono
      // preencher pelo painel.
      if (!cfg.getString('whatsapp_atendimento')) cfg.set('whatsapp_atendimento', '')
      if (!cfg.getString('mensagem_whatsapp')) {
        cfg.set(
          'mensagem_whatsapp',
          'Olá! Sou {nome}, da {empresa}. Concluí o curso {curso} e recebi o código {codigo}. Quero conversar sobre aprofundar o diagnóstico.',
        )
      }
      app.save(cfg)
      console.log('[ead][lote2] ead_config do pre-diagnostico preenchida (whatsapp vazio)')
    } catch (err) {
      console.log('[ead][lote2] FALHA ao configurar ead_config: ' + err.message)
    }
  },
  (app) => {
    // Seed não tem rollback: apagar dores quebraria diagnóstico já respondido.
  },
)
