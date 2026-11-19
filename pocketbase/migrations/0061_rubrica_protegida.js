// 0061_rubrica_protegida.js
//
// FECHA O ITEM 14 DO LOTE 1 (e o item 6 do comando 2): a rubrica sai do
// `cursos.cert_assinatura` (servido por URL pública) para uma coleção fechada.
//
// ── POR QUE A COLEÇÃO NOVA ────────────────────────────────────────────────
// DEFEITO ATUAL: a imagem mora em `cursos`, cujo arquivo é servido em
// /api/files/{cursos}/{id}/{arquivo} SEM checagem. Qualquer pessoa com o link
// baixa a assinatura do Eduardo.
//
// ── COMO A PROTEÇÃO FUNCIONA ──────────────────────────────────────────────
//   * coleção `rubricas`: `listRule`/`viewRule` exigem USUÁRIO AUTENTICADO QUE
//     TENHA CERTIFICADO EMITIDO (`@collection.certificados.user ?= @request.auth.id`).
//   * `createRule`/`updateRule`/`deleteRule` nulos: só o servidor escreve.
//   * a imagem sai por /backend/v1/certificado/{codigo}/rubrica, que confere.
//
// ── MIGRAÇÃO DO QUE JÁ EXISTE ─────────────────────────────────────────────
// Se algum curso tem `cert_assinatura`, a imagem é copiada para a coleção nova
// e o campo antigo é LIMPADO — senão continuaria vazando pela URL antiga, e a
// proteção seria decorativa.

migrate(
  (app) => {
    // 1. coleção `rubricas`
    let col = null
    try {
      col = app.findCollectionByNameOrId('rubricas')
    } catch (_) {}

    if (!col) {
      col = new Collection({
        name: 'rubricas',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (@request.auth.papel = "admin" || @request.auth.papel = "suporte" || @collection.certificados.user ?= @request.auth.id)',
        viewRule:
          '@request.auth.id != "" && (@request.auth.papel = "admin" || @request.auth.papel = "suporte" || @collection.certificados.user ?= @request.auth.id)',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'curso',
            type: 'relation',
            required: true,
            collectionId: 'pbc_2238392150',
            maxSelect: 1,
          },
          {
            name: 'imagem',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 2097152,
            mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
            protected: true,
          },
          { name: 'assinante_nome', type: 'text', required: false, max: 160 },
          { name: 'assinante_cargo', type: 'text', required: false, max: 160 },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_rubricas_curso ON rubricas (curso)'],
      })
      app.save(col)
      console.log('[ead][rubrica] coleção rubricas criada (protegida)')
    } else {
      console.log('[ead][rubrica] coleção rubricas ja existe')
    }

    // 2. migra a rubrica que estiver em `cursos` e limpa o campo antigo
    let migrados = 0
    try {
      const cursos = app.findRecordsByFilter('cursos', "cert_assinatura != ''", '', 50, 0)
      for (let i = 0; i < cursos.length; i++) {
        const curso = cursos[i]
        const nomeArq = String(curso.getString('cert_assinatura') || '').trim()
        if (!nomeArq) continue

        let conteudo = null
        try {
          const dir = $os.dirFS($app.dataDir() + '/storage/' + curso.baseFilesPath())
          const fs = $app.newFilesystem()
          conteudo = fs.getFile(dir, nomeArq)
        } catch (errA) {
          console.log('[ead][rubrica] nao consegui ler o arquivo ' + nomeArq + ': ' + errA.message)
        }

        let ja = null
        try {
          ja = app.findFirstRecordByFilter('rubricas', 'curso = {:c}', { c: curso.id })
        } catch (_) {}

        try {
          if (!ja) {
            ja = new Record(col)
            ja.set('curso', curso.id)
          }
          if (conteudo) ja.set('imagem', conteudo)
          ja.set('assinante_nome', curso.getString('cert_assinante_nome') || '')
          ja.set('assinante_cargo', curso.getString('cert_assinante_cargo') || '')
          app.save(ja)
          migrados++
        } catch (errB) {
          console.log('[ead][rubrica] falha ao migrar curso ' + curso.getString('slug') + ': ' + errB.message)
          continue
        }

        // Limpa o campo antigo: sem isso a URL pública continua servindo.
        try {
          curso.set('cert_assinatura', '')
          app.save(curso)
          console.log('[ead][rubrica] campo antigo limpo em ' + curso.getString('slug'))
        } catch (errC) {
          console.log('[ead][rubrica] FALHA ao limpar campo antigo: ' + errC.message)
        }
      }
    } catch (err) {
      console.log('[ead][rubrica] falha na migracao: ' + err.message)
    }

    console.log('[ead][rubrica] cursos migrados: ' + migrados)
  },
  (app) => {
    // Reverter apagaria a única cópia da imagem. Não é automático.
  },
)
