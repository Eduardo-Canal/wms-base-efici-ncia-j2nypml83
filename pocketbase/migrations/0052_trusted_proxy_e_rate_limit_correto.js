// 0052_trusted_proxy_e_rate_limit_correto.js
//
// REVISÃO EXTERNA, itens 1 e 2.
//
// ITEM 1 — IP REAL ATRÁS DO PROXY (defeito grave que eu introduzi):
// Os dois limitadores (o nativo e o de `limite_requisicoes`) usam `e.realIP()`.
// No PocketBase, `realIP()` só lê o cabeçalho do proxy quando
// `settings.trustedProxy.headers` está configurado — e por padrão vem VAZIO.
// Sem isso, todos os requestes chegam com o IP do proxy do Skip Cloud e o
// limite passa a valer para o SITE INTEIRO: o 11º aluno do dia levaria 429 em
// resgatar voucher, e o 31º em consultar certificado. Pior: o próprio lote 2
// bloqueado por limite de outro.
// Aqui configuramos o cabeçalho que o Skip Cloud injeta.
//
// ITEM 2 — REGRAS NATIVAS ERRADAS:
//  * `*:create`  → o correto é `users:create`. `*:create` casa com o create de
//    TODA coleção (aulas, módulos, produtos...), então o diagnóstico e as
//    respostas do lote 2 esbarravam nela. Fica restrito a `users`.
//  * as regras com `{codigo}` e `{slug}` não casam com rota nenhuma (o
//    limitador nativo só casa rota registrada por ele, e parâmetro com chave
//    não é suportado no rótulo) — removidas.
// As regras de rota própria que valem continuam aplicadas DENTRO dos hooks
// (voucher e certificado), que é onde funciona.

migrate(
  (app) => {
    const st = app.settings()

    // ---- ITEM 1: cabeçalho do proxy confiável ----
    try {
      if (!st.trustedProxy) st.trustedProxy = {}
      const headers = ['X-Forwarded-For', 'X-Real-IP']
      st.trustedProxy.headers = headers
      if (st.trustedProxy.useLeftmostIP === undefined) st.trustedProxy.useLeftmostIP = false
      console.log('[ead] trustedProxy configurado: ' + headers.join(', '))
    } catch (errTp) {
      console.log('[ead] falha ao configurar trustedProxy: ' + errTp.message)
    }

    // ---- ITEM 2: regras do rate limit nativo ----
    try {
      if (st.rateLimits) {
        st.rateLimits.enabled = true

        const novas = [
          { label: 'users:create', maxRequests: 5, duration: 60 },
          { label: '*:authWithPassword', maxRequests: 10, duration: 60 },
        ]

        // Descarta rótulos errados e os nossos, para regravar limpo.
        const descartar = {
          '*:create': true,
          'users:create': true,
          '*:authWithPassword': true,
          '/backend/v1/voucher/resgatar': true,
          '*:/backend/v1/voucher/resgatar': true,
          '/backend/v1/certificado/{codigo}': true,
          '*:/backend/v1/certificado/{codigo}': true,
          '/backend/v1/aulas/{slug}/playback-publico': true,
          '*:/backend/v1/aulas/{slug}/playback-publico': true,
          '*:/backend/v1/versao': true,
        }

        const mantidas = []
        const atuais = st.rateLimits.rules || []
        for (let i = 0; i < atuais.length; i++) {
          if (!descartar[atuais[i].label]) mantidas.push(atuais[i])
        }
        for (let i = 0; i < novas.length; i++) {
          mantidas.push({
            label: novas[i].label,
            maxRequests: novas[i].maxRequests,
            duration: novas[i].duration,
          })
        }
        st.rateLimits.rules = mantidas
      }
    } catch (errRl) {
      console.log('[ead] falha ao ajustar rateLimits: ' + errRl.message)
    }

    try {
      app.save(st)
      console.log('[ead] settings salvos: trustedProxy + rate limit corrigido')
    } catch (err) {
      console.log('[ead] FALHA ao salvar settings: ' + err.message)
    }
  },
  (app) => {
    try {
      const st = app.settings()
      if (st.trustedProxy) st.trustedProxy.headers = []
      if (st.rateLimits) {
        const manter = []
        const atuais = st.rateLimits.rules || []
        for (let i = 0; i < atuais.length; i++) {
          if (atuais[i].label !== 'users:create') manter.push(atuais[i])
        }
        st.rateLimits.rules = manter
      }
      app.save(st)
    } catch (_) {}
  },
)
