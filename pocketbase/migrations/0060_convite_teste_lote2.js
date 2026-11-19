// 0060_convite_teste_lote2.js
//
// Convite de demonstração para eu VALIDAR as telas do lote 2 de ponta a ponta.
//
// POR QUE PRECISO: sem um voucher de convite real, `/presente/{codigo}` devolve
// 404 sempre e eu não consigo distinguir "rota não subiu" de "código inválido" —
// as duas dão 404. Foi exatamente essa confusão que me fez duvidar da rota de
// estrutura.
//
// O QUE CRIA: um convite apontando para o curso 1, com nome de lead, recado e
// empresa de exemplo (os mesmos do mockup, para a tela ficar comparável).
// `so_este_email = false` para eu poder resgatar com o e-mail que eu conseguir
// autenticar.
//
// VIDA ÚTIL: os marcadores (`aberto_em`, `entrou_em`) que o teste gravar vão
// sujar o painel de presentes. A migration 0061 remove este convite no fim.

migrate(
  (app) => {
    const CODIGO = 'ZN7K4QM2PX'

    let ja = null
    try {
      ja = app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: CODIGO })
    } catch (_) {}
    if (ja) {
      console.log('[ead][lote2] convite de teste ja existe')
      return
    }

    let curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (_) {}
    if (!curso) {
      console.log('[ead][lote2] curso 1 nao encontrado; convite nao criado')
      return
    }

    try {
      const col = app.findCollectionByNameOrId('vouchers')
      const v = new Record(col)
      v.set('codigo', CODIGO)
      v.set('tipo', 'acesso')
      v.set('ativo', true)
      v.set('limite_usos', 0)
      v.set('usos', 0)
      v.set('descricao', 'CONVITE DE TESTE do lote 2 (removido pela 0061)')
      v.set('curso', curso.id)
      v.set('nome_lead', 'Marina Duarte')
      v.set('empresa', 'Logística Exemplo')
      v.set(
        'recado',
        'Marina, conversamos sobre a integração do ERP com o armazém. Este curso mostra como eu enxergo esse tema na prática. Depois me conta o que achou.',
      )
      // Falso para o teste: eu não tenho a caixa de marina@logisticaexemplo.com.br.
      v.set('so_este_email', false)
      app.save(v)
      console.log('[ead][lote2] convite de teste criado: ' + CODIGO)
    } catch (err) {
      console.log('[ead][lote2] falha ao criar convite: ' + err.message)
    }
  },
  (app) => {
    try {
      const v = app.findFirstRecordByFilter('vouchers', "codigo = 'ZN7K4QM2PX'")
      app.delete(v)
    } catch (_) {}
  },
)
