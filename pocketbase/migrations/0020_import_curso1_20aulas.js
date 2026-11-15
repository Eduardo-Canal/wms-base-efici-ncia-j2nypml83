// 0020_import_curso1_20aulas — estrutura completa do Curso 1: 6 módulos e 20 aulas.
// Fonte: artifacts/ead-curso1-import-v3.json. Idempotente por slug.
// Aulas nascem publicado=false (só a 01 é amostra): publicar cada uma é decisão
// do Eduardo, junto com o vídeo pronto.
migrate(
  (app) => {
    var curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (e) {}
    if (!curso) return

    var defsMod = [
      ['fund-m01-logistica-in-house', 'Por que a logística in house trava', 1],
      ['fund-m02-sistemas-da-logistica', 'O mapa de sistemas da operação', 2],
      ['fund-m03-o-que-esperar-de-um-wms', 'O que esperar de um WMS', 3],
      ['fund-m04-erp-x-wms', 'A integração mais crítica: ERP x WMS', 4],
      ['fund-m05-tms-oms-vmi', 'TMS, OMS e VMI', 5],
      ['fund-m06-automacao-e-infraestrutura', 'Automação e onde rodar', 6],
    ]
    var colM = app.findCollectionByNameOrId('modulos')
    var colA = app.findCollectionByNameOrId('aulas')
    var m = {}

    for (var i = 0; i < defsMod.length; i++) {
      var slugM = defsMod[i][0]
      var mod = null
      try {
        mod = app.findFirstRecordByFilter('modulos', 'slug = {:s}', { s: slugM })
      } catch (e) {}
      if (!mod) {
        mod = new Record(colM)
        mod.set('curso', curso.id)
        mod.set('slug', slugM)
        mod.set('titulo', defsMod[i][1])
        mod.set('ordem', defsMod[i][2])
        app.save(mod)
      }
      m[slugM] = mod
    }

    // slug, numero, titulo, modulo, amostra, pergunta de fixacao
    var aulas = [
      [
        'fund-a01-desafios-logistica-in-house',
        'Aula 01',
        'Os cinco pontos onde a operação in house perde dinheiro',
        'fund-m01-logistica-in-house',
        true,
        'Qual dos cinco pontos você consegue medir hoje na sua operação — e qual você só acha que sabe?',
      ],
      [
        'fund-a02-papel-da-tecnologia',
        'Aula 02',
        'O papel da tecnologia na logística',
        'fund-m01-logistica-in-house',
        false,
        'Se você tivesse que melhorar uma das cinco funções da tecnologia nos próximos 90 dias, qual daria mais resultado?',
      ],
      [
        'fund-a03-historia-da-tecnologia',
        'Aula 03',
        'Como a tecnologia logística evoluiu até o WMS',
        'fund-m01-logistica-in-house',
        false,
        'Onde o seu processo ainda está em 1980 — registrando estoque em vez de comandar a operação?',
      ],
      [
        'fund-a04-sistemas-envolvidos',
        'Aula 04',
        'ERP, TMS, OMS, VMI e automação: quem faz o quê',
        'fund-m02-sistemas-da-logistica',
        false,
        'Desenhe os sistemas da sua operação e marque as setas de integração. Quantas passam por planilha?',
      ],
      [
        'fund-a05-fluxo-de-integracao',
        'Aula 05',
        'O fluxo de integração entre sistemas, desenhado',
        'fund-m02-sistemas-da-logistica',
        false,
        'Qual integração hoje depende de uma pessoa de boa vontade — e o que acontece quando ela sai de férias?',
      ],
      [
        'fund-a06-estrategias-de-integracao',
        'Aula 06',
        'As cinco estratégias de integração e o custo de cada uma',
        'fund-m02-sistemas-da-logistica',
        false,
        'Quantos sistemas precisam conversar na sua operação? O que você usa hoje aguenta esse número em dois anos?',
      ],
      [
        'fund-a07-funcionalidades-basicas',
        'Aula 07',
        'As funcionalidades que todo WMS precisa ter',
        'fund-m03-o-que-esperar-de-um-wms',
        false,
        'Liste as três funções que sua operação usa todo dia. O seu WMS atual faz as três bem?',
      ],
      [
        'fund-a08-adaptacao-ao-negocio',
        'Aula 08',
        'Quando adaptar o WMS ao seu processo (e quando não)',
        'fund-m03-o-que-esperar-de-um-wms',
        false,
        'Quais processos da sua operação são realmente seus — e não do mercado? Esses não podem ser adaptados ao sistema.',
      ],
      [
        'fund-a09-tendencias-e-inovacoes',
        'Aula 09',
        'Tendências que estão mudando o WMS',
        'fund-m03-o-que-esperar-de-um-wms',
        false,
        'Qual tecnologia emergente resolveria hoje uma dor que você já sabe medir?',
      ],
      [
        'fund-a10-erp-x-wms-performance',
        'Aula 10',
        'Buscando a máxima performance: ERP x WMS',
        'fund-m04-erp-x-wms',
        false,
        'Quem manda no saldo de estoque hoje na sua empresa? A resposta é uma frase clara ou depende de quem você pergunta?',
      ],
      [
        'fund-a11-quem-e-o-sistema-origem',
        'Aula 11',
        'Quem é o sistema origem, ERP ou WMS',
        'fund-m04-erp-x-wms',
        false,
        'No seu caso, a informação nasce mais perto do armazém ou do faturamento?',
      ],
      [
        'fund-a12-fluxo-erp-wms',
        'Aula 12',
        'O fluxo ERP & WMS na prática: embarcador e prestador',
        'fund-m04-erp-x-wms',
        false,
        'Sua operação é embarcador ou prestador? O fluxo que você usa hoje foi desenhado para qual dos dois?',
      ],
      [
        'fund-a13-integracao-tms',
        'Aula 13',
        'WMS e TMS: além dos limites do armazém',
        'fund-m05-tms-oms-vmi',
        false,
        'O seu TMS sabe, antes de o caminhão chegar, o que vai sair?',
      ],
      [
        'fund-a14-integracao-oms',
        'Aula 14',
        'WMS e OMS: além dos pedidos',
        'fund-m05-tms-oms-vmi',
        false,
        'Quando o site promete o prazo, ele pergunta ao armazém antes ou depois de prometer?',
      ],
      [
        'fund-a15-integracao-vmi',
        'Aula 15',
        'WMS e VMI: estoque do fornecedor dentro da sua operação',
        'fund-m05-tms-oms-vmi',
        false,
        'Você tem estoque de terceiro no seu armazém? Onde ele está marcado?',
      ],
      [
        'fund-a16-automacao-portaria',
        'Aula 16',
        'Automação na portaria',
        'fund-m06-automacao-e-infraestrutura',
        false,
        'Quanto tempo um caminhão espera na sua portaria, em média, do portão à doca?',
      ],
      [
        'fund-a17-automacao-recebimento',
        'Aula 17',
        'Automação no recebimento',
        'fund-m06-automacao-e-infraestrutura',
        false,
        'Qual etapa do seu recebimento é conferida à mão hoje?',
      ],
      [
        'fund-a18-automacao-armazenagem-picking',
        'Aula 18',
        'Automação na armazenagem e no picking',
        'fund-m06-automacao-e-infraestrutura',
        false,
        'Sua operação justifica AS/RS — alta densidade, pouco espaço e muita movimentação?',
      ],
      [
        'fund-a19-automacao-expedicao',
        'Aula 19',
        'Automação na expedição',
        'fund-m06-automacao-e-infraestrutura',
        false,
        'Onde você ainda confere picking e embarque no papel?',
      ],
      [
        'fund-a20-on-premise-vs-saas',
        'Aula 20',
        'On-premise ou SaaS: a decisão que você não pode errar',
        'fund-m06-automacao-e-infraestrutura',
        false,
        'Se o seu servidor cair agora, quanto tempo você leva para voltar a expedir?',
      ],
    ]

    for (var j = 0; j < aulas.length; j++) {
      var a = aulas[j]
      var ordem = j + 1
      var existe = null
      try {
        existe = app.findFirstRecordByFilter('aulas', 'slug = {:s}', { s: a[0] })
      } catch (e) {}
      if (existe) {
        // já existe: acerta título, número e módulo (não mexe em vídeo/publicação)
        try {
          existe.set('titulo', a[2])
          existe.set('numero', a[1])
          existe.set('modulo', m[a[3]].id)
          existe.set('ordem', ordem)
          if (a[4]) existe.set('amostra', true)
          existe.set('pergunta_fixacao', a[5])
          app.save(existe)
        } catch (e2) {
          console.log('[ead] atualiza ' + a[0] + ': ' + e2.message)
        }
        continue
      }
      try {
        var r = new Record(colA)
        r.set('modulo', m[a[3]].id)
        r.set('slug', a[0])
        r.set('numero', a[1])
        r.set('titulo', a[2])
        r.set('ordem', ordem)
        r.set('publicado', false)
        r.set('amostra', a[4])
        r.set('pergunta_fixacao', a[5])
        app.save(r)
      } catch (e3) {
        console.log('[ead] cria ' + a[0] + ': ' + e3.message)
      }
    }
    console.log('[ead] import curso 1: ' + aulas.length + ' aulas e ' + defsMod.length + ' modulos')
  },
  (app) => {
    // rollback seguro: só apaga aulas ainda NÃO publicadas (nada de produção)
    try {
      var rs = app.findRecordsByFilter('aulas', 'publicado = false', '', 100, 0)
      for (var i = 0; i < rs.length; i++) {
        try {
          app.delete(rs[i])
        } catch (e) {}
      }
    } catch (e) {}
  },
)
