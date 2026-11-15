// 0025_ead_config_e_mp_link.js
//
// Duas coisas que o dono pediu, e por que cada uma existe:
//
// 1. `ead_config` — o BOTÃO DE LIBERAR.
//    O Eduardo quer montar e testar o EAD sem que visitante veja nada. Sem um
//    portão central, "escondido" dependeria de cada tela lembrar de esconder, e
//    uma tela que esquece expõe a área inteira. Aqui o portão é DADO: enquanto
//    `liberado = false`, o visitante recebe lista vazia desta coleção e os
//    endpoints do EAD respondem 403 (hook portao.pb.js). Admin e suporte
//    continuam vendo tudo — é assim que ele testa antes de liberar.
//    Registro único: `chave = "principal"`, criado por esta migration, para o
//    painel nunca abrir vazio.
//
// 2. `produtos.mp_link` — o LINK DE PAGAMENTO editável.
//    Ele cadastra o link no Mercado Pago e cola aqui. Trocar preço ou link
//    passa a ser edição de campo, sem build e sem deploy.
//    LIMITE HONESTO: link de pagamento é ESTÁTICO — não informa quem pagou,
//    então não existe liberação automática por essa via. O fluxo real é:
//    aluno paga → admin confere no painel do MP → libera em /ead/admin.
//    Liberação automática exige Checkout Pro + webhook (código já existe em
//    checkout.pb.js / webhook-mercadopago.pb.js; falta credencial e teste).
//
// ADITIVA: não toca em nada existente. Só cria uma coleção e dois campos.

migrate(
  (app) => {
    const usuarios = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'

    // ---- 1. ead_config ----
    // Regras e campos na MESMA chamada: o PocketBase valida a regra contra os
    // campos no momento do save.
    const config = new Collection({
      name: 'ead_config',
      type: 'base',
      // Visitante só enxerga a configuração depois de liberada — é assim que o
      // front sabe que a área está fechada, sem precisar de outro endpoint.
      listRule: `liberado = true || ${usuarios}`,
      viewRule: `liberado = true || ${usuarios}`,
      // Só admin altera. Suporte lê, não muda.
      createRule: '@request.auth.papel = "admin"',
      updateRule: '@request.auth.papel = "admin"',
      deleteRule: '@request.auth.papel = "admin"',
      fields: [
        { name: 'chave', type: 'text', required: true, min: 1, max: 20 },
        { name: 'liberado', type: 'bool' },
        { name: 'titulo_area', type: 'text', max: 80 },
        { name: 'aviso_rascunho', type: 'text', max: 500 },
        { name: 'instrucoes_compra', type: 'text', max: 5000 },
        { name: 'email_suporte', type: 'text', max: 120 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_ead_config_chave ON ead_config (chave)'],
    })
    app.save(config)

    // Registro único. Sem ele o painel abriria sem nada para editar.
    const registro = new Record(config)
    registro.set('chave', 'principal')
    registro.set('liberado', false)
    registro.set('titulo_area', 'Cursos')
    registro.set(
      'aviso_rascunho',
      'Área em montagem. Só administradores veem esta página. Ligue "Liberar para o público" quando estiver pronto para vender.',
    )
    app.save(registro)

    // ---- 2. produtos.mp_link ----
    const produtos = app.findCollectionByNameOrId('produtos')

    if (!produtos.fields.getByName('mp_link')) {
      produtos.fields.add(
        new TextField({
          name: 'mp_link',
          required: false,
          // Vazio é válido: cadastrar produto antes de ter o link é normal.
          // Quem impede a venda sem link é a tela, que esconde o botão.
          max: 500,
        }),
      )
    }
    if (!produtos.fields.getByName('mp_link_obs')) {
      produtos.fields.add(
        new TextField({
          name: 'mp_link_obs',
          required: false,
          max: 200,
        }),
      )
    }
    app.save(produtos)
  },
  (app) => {
    try {
      const produtos = app.findCollectionByNameOrId('produtos')
      if (produtos.fields.getByName('mp_link')) produtos.fields.removeByName('mp_link')
      if (produtos.fields.getByName('mp_link_obs')) produtos.fields.removeByName('mp_link_obs')
      app.save(produtos)
    } catch (_) {
      /* se produtos não existir mais, não há o que reverter */
    }
    try {
      app.delete(app.findCollectionByNameOrId('ead_config'))
    } catch (_) {
      /* já removida */
    }
  },
)
