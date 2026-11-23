// 0063_abre_area_e_ead_config.js
//
// CENÁRIO APROVADO PELO DONO (20/11): "uma pessoa qualquer quer se cadastrar e
// pode ver os vídeos liberados de isca" — opção (ii) que eu propus:
//
//   * VISITANTE vê a vitrine do curso (título, resumo, módulos, nº de aulas,
//     preço) e assiste a AULA ISCA;
//   * NÃO vê o TÍTULO das aulas pagas — essa lista é do aluno;
//   * clicar numa aula paga leva à tela de compra.
//
// ── POR QUE ESTA MIGRATION ────────────────────────────────────────────────
// `ead_config` estava VAZIA. Todo o portão do projeto faz
// `findFirstRecordByFilter('ead_config', "chave = 'principal'")` e, quando não
// encontra, assume FECHADO (decisão de segurança correta). Resultado: ninguém —
// nem visitante, nem aluno — abria nada. Sem este registro, o cenário não
// existe.
//
// `liberado = true` abre a VITRINE. Não abre o conteúdo: quem protege a aula
// paga é o endpoint de playback (que exige matrícula) e o portão de `aulas`
// (que continua exigindo equipe ou matrícula — ver portao-listagem.pb.js).
//
// Reversível: a migration de baixo desliga o portão.

migrate(
  (app) => {
    let cfg = null
    try {
      cfg = app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    } catch (_) {}

    if (cfg) {
      // Já existe: só garante que está liberado (o dono pode ter desligado).
      if (!cfg.getBool('liberado')) {
        cfg.set('liberado', true)
        app.save(cfg)
        console.log('[ead][config] liberado = true (registro existente)')
      } else {
        console.log('[ead][config] ja existia e ja estava liberado')
      }
      return
    }

    try {
      const col = app.findCollectionByNameOrId('ead_config')
      const r = new Record(col)
      r.set('chave', 'principal')
      r.set('liberado', true)
      r.set('titulo_area', 'Cursos')
      r.set(
        'aviso_rascunho',
        'A área de cursos está aberta. Algumas aulas ainda podem estar em produção.',
      )
      // Regras do pré-diagnóstico: valores iniciais para o painel não nascer
      // com campo vazio. O dono ajusta em Conteúdo → Regras.
      r.set('maturidade_por_controle', {
        planilha: 1,
        erp: 2,
        wms_mercado: 4,
        sistema_proprio: 3,
        implantando: 2,
      })
      r.set('textos_maturidade', {
        1: 'A operação depende de planilha e memória de quem está no turno.',
        2: 'O ERP controla estoque, mas não controla o processo dentro do armazém.',
        3: 'Existe sistema próprio: cobre o básico, mas falta integração com o resto.',
        4: 'WMS de mercado em uso, com processo definido e indicadores.',
        5: 'Operação medida ponta a ponta, com integração e melhoria contínua.',
      })
      r.set('proximo_passo_por_momento', {
        estudando: 'Comece pelo diagnóstico da operação: o que mede e o que não mede.',
        avaliando: 'Liste os requisitos por processo antes de ver fornecedor.',
        projeto_aprovado: 'Defina escopo, integração e critério de aceite antes de assinar.',
        tem_wms: 'Meça o que o sistema atual não entrega e priorize o que dá retorno.',
      })
      app.save(r)
      console.log('[ead][config] registro principal criado com liberado = true')
    } catch (err) {
      console.log('[ead][config] FALHA ao criar: ' + err.message)
    }
  },
  (app) => {
    try {
      const cfg = app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
      cfg.set('liberado', false)
      app.save(cfg)
    } catch (_) {}
  },
)
