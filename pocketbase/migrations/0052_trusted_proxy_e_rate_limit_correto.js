// 0052_trusted_proxy_e_rate_limit_correto.js
//
// REVISÃO EXTERNA, itens 1 e 2.
//
// ITEM 1 — IP REAL ATRÁS DO PROXY:
// Os dois limitadores usam `e.realIP()`, que só lê o cabeçalho do proxy quando
// `settings.trustedProxy.headers` está configurado — e por padrão vem VAZIO.
// Sem isso, todos chegam com o IP do proxy e o limite vale para o SITE INTEIRO
// (o 11º aluno do dia levaria 429 em resgatar voucher).
//
// ITEM 2 — REGRAS NATIVAS ERRADAS:
//  * `*:create` → `users:create` (o asterisco casava com o create de TODA
//    coleção, e o diagnóstico do lote 2 esbarrava nela).
//  * regras com `{codigo}` e `{slug}` não casam com rota nenhuma — removidas.

migrate(
  (app) => {
    const st = app.settings()

    // ---- ITEM 1: cabeçalho do proxy confiável ----
    try {
      if (!st.trustedProxy) st.trustedProxy = {}
      st.trustedProxy.headers = ['X-Forwarded-For', 'X-Real-IP']
      console.log('[ead] trustedProxy configurado')
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
      app.save(st)
    } catch (_) {}
  },
)
