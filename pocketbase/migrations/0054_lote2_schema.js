// 0054_lote2_schema.js
//
// LOTE 2 — schema do fluxo do presente.
//
// Só ADIÇÃO: nenhum campo existente é renomeado ou apagado.
//   * users: OTP habilitado (6 dígitos, 10 min) + `empresa`
//   * vouchers: convite pessoal + marcos da jornada
//   * cursos: status, descricao_curta, aulas_previstas
//   * ead_config: regras do pré-diagnóstico + WhatsApp
//
// OTP na COLEÇÃO porque o endpoint nativo request-otp só responde com
// otp.enabled = true (testado: sem isso devolve 403 "not configured to allow
// OTP authentication").

migrate(
  (app) => {
    // 1. users
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.otp = { enabled: true, duration: 600, length: 6 }
      if (!users.fields.getByName('empresa')) {
        users.fields.add(new TextField({ name: 'empresa', required: false, max: 160 }))
      }
      app.save(users)
      console.log('[ead][lote2] users: OTP on + empresa')
    } catch (err) {
      console.log('[ead][lote2] FALHA users: ' + err.message)
    }

    // 2. vouchers
    try {
      const v = app.findCollectionByNameOrId('vouchers')
      const campos = [
        new TextField({ name: 'nome_lead', required: false, max: 160 }),
        new TextField({ name: 'empresa', required: false, max: 160 }),
        new TextField({ name: 'whatsapp_lead', required: false, max: 32 }),
        new TextField({ name: 'recado', required: false, max: 500 }),
        new RelationField({
          name: 'responsavel',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
        new BoolField({ name: 'so_este_email', required: false }),
        new RelationField({
          name: 'curso',
          required: false,
          collectionId: 'pbc_2238392150',
          maxSelect: 1,
        }),
        new DateField({ name: 'aberto_em', required: false }),
        new DateField({ name: 'entrou_em', required: false }),
        new DateField({ name: 'diagnostico_em', required: false }),
        new DateField({ name: 'concluiu_em', required: false }),
        new DateField({ name: 'aprofundamento_em', required: false }),
      ]
      let add = 0
      for (let i = 0; i < campos.length; i++) {
        if (!v.fields.getByName(campos[i].name)) {
          v.fields.add(campos[i])
          add++
        }
      }
      app.save(v)
      console.log('[ead][lote2] vouchers: ' + add + ' campos')
    } catch (err) {
      console.log('[ead][lote2] FALHA vouchers: ' + err.message)
    }

    // 3. cursos
    try {
      const c = app.findCollectionByNameOrId('cursos')
      if (!c.fields.getByName('status')) {
        c.fields.add(
          new SelectField({
            name: 'status',
            required: false,
            maxSelect: 1,
            values: ['rascunho', 'em_breve', 'publicado'],
          }),
        )
      }
      if (!c.fields.getByName('descricao_curta')) {
        c.fields.add(new TextField({ name: 'descricao_curta', required: false, max: 200 }))
      }
      if (!c.fields.getByName('aulas_previstas')) {
        c.fields.add(new NumberField({ name: 'aulas_previstas', required: false, min: 0 }))
      }
      app.save(c)
      console.log('[ead][lote2] cursos: status + descricao_curta + aulas_previstas')
    } catch (err) {
      console.log('[ead][lote2] FALHA cursos: ' + err.message)
    }

    // 4. ead_config
    try {
      const cfg = app.findCollectionByNameOrId('ead_config')
      const jsons = ['maturidade_por_controle', 'textos_maturidade', 'proximo_passo_por_momento']
      for (let i = 0; i < jsons.length; i++) {
        if (!cfg.fields.getByName(jsons[i])) {
          cfg.fields.add(new JSONField({ name: jsons[i], required: false, maxSize: 100000 }))
        }
      }
      if (!cfg.fields.getByName('whatsapp_atendimento')) {
        cfg.fields.add(new TextField({ name: 'whatsapp_atendimento', required: false, max: 20 }))
      }
      if (!cfg.fields.getByName('mensagem_whatsapp')) {
        cfg.fields.add(new TextField({ name: 'mensagem_whatsapp', required: false, max: 1000 }))
      }
      app.save(cfg)
      console.log('[ead][lote2] ead_config: pre-diagnostico + WhatsApp')
    } catch (err) {
      console.log('[ead][lote2] FALHA ead_config: ' + err.message)
    }
  },
  (app) => {
    // Reverter removeria campos com dado. Não é automático.
  },
)
