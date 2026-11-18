// 0046_rate_limit_rotas_proprias.js
//
// REVISÃO EXTERNA, item 11 — CORREÇÃO da migration 0045.
//
// O QUE ACONTECEU: a 0045 ligou o rate limit, e o teste de rajada confirmou que
// a rota NATIVA funciona (`*:authWithPassword`: 10 passaram, a 11ª recebeu
// 429). Mas as rotas PRÓPRIAS (`/backend/v1/...`) não foram limitadas: 13
// requisições seguidas ao resgate de voucher passaram todas sem 429.
//
// CAUSA: o PocketBase identifica a rota pelo par MÉTODO + CAMINHO no rótulo.
// O formato aceito é `<método>:<caminho>` (ou `*:<caminho>`). A 0045 gravou só
// o caminho, sem o prefixo de método, e nenhuma rota casou com o rótulo.
//
// CORREÇÃO: regrava com `*:` na frente. Mantém as regras da 0045 que já
// funcionavam e remove os rótulos sem método, para não ficar lixo.

migrate(
  (app) => {
    const settings = app.settings()
    if (!settings.rateLimits) {
      console.log('[ead] rateLimits não disponível; nada alterado')
      return
    }
    settings.rateLimits.enabled = true

    // Rótulos corretos (com prefixo de método).
    const novas = [
      { label: '*:authWithPassword', maxRequests: 10, duration: 60 },
      { label: '*:create', maxRequests: 5, duration: 60 },
      { label: '*:/backend/v1/voucher/resgatar', maxRequests: 10, duration: 60 },
      { label: '*:/backend/v1/certificado/{codigo}', maxRequests: 30, duration: 60 },
      { label: '*:/backend/v1/aulas/{slug}/playback-publico', maxRequests: 30, duration: 60 },
      { label: '*:/backend/v1/versao', maxRequests: 60, duration: 60 },
    ]

    // Remove os rótulos errados da 0045 (sem método) e os nossos, para regravar.
    const descartar = {}
    descartar['/backend/v1/voucher/resgatar'] = true
    descartar['/backend/v1/certificado/{codigo}'] = true
    descartar['/backend/v1/aulas/{slug}/playback-publico'] = true
    for (let i = 0; i < novas.length; i++) descartar[novas[i].label] = true

    const mantidas = []
    const atuais = settings.rateLimits.rules || []
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

    settings.rateLimits.rules = mantidas
    try {
      app.save(settings)
      console.log('[ead] rate limit: rótulos regravados com método (' + novas.length + ' regras)')
    } catch (err) {
      console.log('[ead] rate limit: falha ao salvar: ' + err.message)
    }
  },
  (app) => {
    // Reverter é deixar como a 0045 deixou; não vale a pena reescrever rótulo quebrado.
  },
)
