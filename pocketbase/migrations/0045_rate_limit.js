// 0045_rate_limit.js
//
// REVISÃO EXTERNA, item 11 (e fecha parte do item 16).
//
// O QUE FAZ: liga o limitador NATIVO do PocketBase nas rotas que a revisão
// apontou como sensíveis a força bruta e a abuso:
//
//   POST /api/collections/users/auth-with-password   10 / 60 s
//   POST /api/collections/users/records               5 / 60 s   (cadastro)
//   POST /backend/v1/voucher/resgatar                10 / 60 s
//   GET  /backend/v1/certificado/{codigo}            30 / 60 s
//   GET  /backend/v1/aulas/{slug}/playback-publico   30 / 60 s   (item 16)
//
// POR QUE MIGRATION: o limitador é configuração do servidor (settings), e o
// painel do Skip Cloud não expõe essa tela para mim. Migration roda como
// superuser e é auditável — fica no histórico com data e motivo.
//
// COMO O POCKETBASE IDENTIFICA A ROTA: pelo rótulo da regra. Rotas nativas usam
// `*:nomeDaAcao`; rotas próprias usam o caminho. Os rótulos abaixo seguem essa
// convenção. Se algum rótulo não casar com uma rota existente, o PocketBase
// simplesmente não aplica aquela regra — não quebra o boot.
//
// IDEMPOTENTE: substitui apenas as regras com estes rótulos, preservando
// qualquer outra que já exista.

migrate(
  (app) => {
    const settings = app.settings()
    if (!settings.rateLimits) {
      console.log('[ead] rateLimits não disponível nesta versão; nada alterado')
      return
    }

    settings.rateLimits.enabled = true

    const novas = [
      { label: '*:authWithPassword', maxRequests: 10, duration: 60 },
      { label: '*:create', maxRequests: 5, duration: 60 },
      { label: '/backend/v1/voucher/resgatar', maxRequests: 10, duration: 60 },
      { label: '/backend/v1/certificado/{codigo}', maxRequests: 30, duration: 60 },
      { label: '/backend/v1/aulas/{slug}/playback-publico', maxRequests: 30, duration: 60 },
    ]

    // Preserva regras de outros rótulos e substitui só as nossas.
    const nossos = {}
    for (let i = 0; i < novas.length; i++) nossos[novas[i].label] = true

    const mantidas = []
    const atuais = settings.rateLimits.rules || []
    for (let i = 0; i < atuais.length; i++) {
      const r = atuais[i]
      if (!nossos[r.label]) mantidas.push(r)
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
      console.log('[ead] rate limit ligado: ' + novas.length + ' regras aplicadas')
    } catch (err) {
      console.log('[ead] rate limit: falha ao salvar settings: ' + err.message)
    }
  },
  (app) => {
    try {
      const settings = app.settings()
      if (!settings.rateLimits) return
      const nossos = {
        '*:authWithPassword': true,
        '*:create': true,
        '/backend/v1/voucher/resgatar': true,
        '/backend/v1/certificado/{codigo}': true,
        '/backend/v1/aulas/{slug}/playback-publico': true,
      }
      const mantidas = []
      const atuais = settings.rateLimits.rules || []
      for (let i = 0; i < atuais.length; i++) {
        if (!nossos[atuais[i].label]) mantidas.push(atuais[i])
      }
      settings.rateLimits.rules = mantidas
      app.save(settings)
    } catch (_) {}
  },
)
