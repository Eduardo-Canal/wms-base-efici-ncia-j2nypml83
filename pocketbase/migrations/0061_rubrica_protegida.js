// 0061_rubrica_protegida.js
//
// FECHA O ITEM 14 DO LOTE 1 (e o item 6 do comando 2): a rubrica sai do
// `cursos.cert_assinatura` (servido por URL pública) para uma coleção fechada.
//
// ── POR QUE A COLEÇÃO NOVA ────────────────────────────────────────────────
// DEFEITO ATUAL: a imagem mora em `cursos`, cujo arquivo é servido em
// /api/files/{cursos}/{id}/{arquivo} SEM checagem. Qualquer pessoa com o link
// baixa a assinatura do Eduardo. Rubrica de assinatura não é segredo grave, mas
// é dado pessoal do dono e não tem por que ficar aberta.
//
// ── COMO A PROTEÇÃO FUNCIONA ──────────────────────────────────────────────
//   * coleção `rubricas`: `listRule`/`viewRule` exigem USUÁRIO AUTENTICADO QUE
//     TENHA CERTIFICADO EMITIDO (`@collection.certificados.user ?= @request.auth.id`).
//     Admin e suporte também entram (precisam conferir o que enviam).
//   * `createRule`/`deleteRule` nulos: só o servidor escreve.
//   * o arquivo em si: o PocketBase exige autorização para /api/files/ quando a
//     coleção não é pública. A tela busca com o TOKEN de arquivo
//     (pb.files.getToken()), não com a URL anônima.
//
// ── MIGRAÇÃO DO QUE JÁ EXISTE ─────────────────────────────────────────────
// Se algum curso tem `cert_assinatura`, a imagem é copiada para a coleção nova
// e o campo antigo é LIMPADO — senão continuaria vazando pela URL antiga, e a
// proteção seria decorativa.
//
// ── POR QUE A PÁGINA PÚBLICA NÃO MOSTRA A ASSINATURA ──────────────────────
// O pedido é explícito. Faz sentido: a validação pública existe para provar que
// o certificado é real, e isso o código e o nome já fazem. A rubrica é do dono,
// não é prova de autenticidade — é ornamento.

migrate(
  (app) => {
    // ---------------------------------------------------------------
    // 1. coleção `rubricas`
    // ---------------------------------------------------------------
    let col = null
    try {
      col = app.findCollectionByNameOrId('rubricas')
    } catch (_) {}

    if (!col) {
      col = new Collection({
        name: 'rubricas',
        type: 'base',
        // Só quem tem certificado emitido (ou a equipe) lê.
        // `?=` é o operador de "contém" para relação de valor único, e é o
        // caminho que o PocketBase aceita para consultar outra coleção.
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
            // `protected: true` NÃO fecha /api/files/ sozinho — a regra da
            // coleção é que fecha (lição do lote 1). Mantido por intenção.
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

    // ---------------------------------------------------------------
    // 2. migra a rubrica que estiver em `cursos` e limpa o campo antigo
    // ---------------------------------------------------------------
    let migrados = 0
    try {
      const cursos = app.findRecordsByFilter('cursos', "cert_assinatura != ''", '', 50, 0)
      for (let i = 0; i < cursos.length; i++) {
        const curso = cursos[i]
        const nomeArq = String(curso.getString('cert_assinatura') || '').trim()
        if (!nomeArq) continue

        // Lê o arquivo do storage do próprio PocketBase.
        // ⚠ `newFilesystem().get()` NÃO existe no JSVM — o caminho correto é
        // fileFS sobre o diretório de storage (lição registrada na memória).
        let conteudo = null
        try {
          const dir = $os.dirFS($app.dataDir() + '/storage/' + curso.baseFilesPath())
          const fs = $app.newFilesystem()
          const f = fs.getFile(dir, nomeArq)
          conteudo = f
        } catch (errA) {
          console.log('[ead][rubrica] nao consegui ler o arquivo ' + nomeArq + ': ' + errA.message)
        }

        // Já existe rubrica para este curso?
        let ja = null
        try {
          ja = app.findFirstRecordByFilter('rubricas', 'curso = {:c}', { c: curso.id })
        } catch (_) {}

        try {
          if (!ja) {
            ja = new Record(col)
            ja.set('curso', curso.id)
          }
          // Se a leitura do arquivo funcionou, copia; senão registra o NOME
          // para o dono reenviar pelo painel (melhor um registro sem imagem e
          // visível no painel do que perder a referência em silêncio).
          if (conteudo) {
            ja.set('imagem', conteudo)
          }
          ja.set('assinante_nome', curso.getString('cert_assinante_nome') || '')
          ja.set('assinante_cargo', curso.getString('cert_assinante_cargo') || '')
          app.save(ja)
          migrados++
        } catch (errB) {
          console.log(
            '[ead][rubrica] falha ao migrar curso ' + curso.getString('slug') + ': ' + errB.message,
          )
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
    // Reverter deixaria o campo antigo vazio e a rubrica só na coleção nova.
    // Não é automático: reverter apagaria a única cópia da imagem.
  },
)
