// admin-limite-status.pb.js — GET /backend/v1/admin/limite
//
// Diagnóstico do limitador de rotas próprias (item 11) e da configuração de
// proxy confiável (item 1). Mostra o IP visto, os cabeçalhos recebidos, se o
// trustedProxy está ligado, e a contagem corrente por chave.
//
// Só admin. Não expõe segredo, mas expõe cabeçalho de requisição — que é dado
// de quem chamou.

routerAdd(
  'GET',
  '/backend/v1/admin/limite',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    let ipReal = ''
    try {
      ipReal = String(e.realIP() || '')
    } catch (_) {}
    let xff = ''
    try {
      xff = String(e.request.header.get('x-forwarded-for') || '')
    } catch (_) {}
    let xri = ''
    try {
      xri = String(e.request.header.get('x-real-ip') || '')
    } catch (_) {}

    let tpHeaders = ''
    let tpAtivo = false
    try {
      const st = $app.settings()
      if (st.trustedProxy && st.trustedProxy.headers && st.trustedProxy.headers.length) {
        tpHeaders = st.trustedProxy.headers.join(',')
        tpAtivo = true
      }
    } catch (_) {}

    const linhas = []
    try {
      const regs = $app.findRecordsByFilter('limite_requisicoes', "id != ''", '-janela_inicio', 50, 0)
      for (let i = 0; i < regs.length; i++) {
        linhas.push({
          chave: regs[i].getString('chave'),
          contador: regs[i].getInt('contador'),
          janela_inicio: regs[i].getString('janela_inicio'),
        })
      }
    } catch (_) {}

    return e.json(200, {
      ip_visto_pelo_servidor: ipReal,
      cabecalhos: { 'x-forwarded-for': xff, 'x-real-ip': xri },
      trusted_proxy: {
        ativo: tpAtivo,
        headers: tpAtivo ? tpHeaders : '',
        efeito: tpAtivo
          ? 'IP real em uso: o limite conta por pessoa.'
          : 'IP do proxy em uso: o limite conta o site inteiro como um cliente só.',
      },
      total_linhas: linhas.length,
      linhas: linhas,
    })
  },
  $apis.requireAuth(),
)
