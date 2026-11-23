// limite-contagem.pb.js — limitador para ROTAS PRÓPRIAS, com IP REAL.
//
// REVISÃO EXTERNA, itens 1 e 4. Este arquivo expõe a contagem usada pelos hooks
// de voucher e certificado. Antes a lógica estava copiada dentro de cada hook,
// o que fazia o mesmo bug ser corrigido duas vezes (ou esquecido numa delas).
//
// ⚠ ESCOPO DO JSVM: cada handler roda isolado, então isto NÃO é uma função
// compartilhada — é um endpoint de diagnóstico (`GET /backend/v1/admin/limite`)
// que mostra a contagem corrente, e a lógica de contagem continua INLINE dentro
// de cada hook (por exigência do runtime).
//
// IP REAL ATRÁS DO PROXY (item 1):
// `e.realIP()` no PocketBase só devolve o IP do cabeçalho do proxy quando
// `settings.trustedProxy.headers` está configurado. Sem isso, TODOS os
// requentes chegam com o mesmo IP (o do proxy do Skip Cloud) e o limite passa a
// valer para o site inteiro: o 11º aluno do dia seria bloqueado.
// A migration 0052 configura esse cabeçalho; este endpoint mostra o que o
// servidor está vendo, para provar que a configuração pegou.

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

    // ---- 1. o que o servidor acha que é o IP de quem pediu ----
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

    // ---- 2. a configuração de proxy confiável está ativa? ----
    let trustedHeaders = ''
    let trustedAtivo = false
    try {
      const st = $app.settings()
      const tp = st.trustedProxy
      if (tp && tp.headers && tp.headers.length) {
        trustedHeaders = tp.headers.join(',')
        trustedAtivo = tp.headers.length > 0
      }
    } catch (errTp) {
      trustedHeaders = 'erro: ' + errTp.message
    }

    // ---- 3. contagem corrente ----
    const linhas = []
    try {
      const regs = $app.findRecordsByFilter(
        'limite_requisicoes',
        "id != ''",
        '-janela_inicio',
        50,
        0,
      )
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
      cabecalhos: {
        'x-forwarded-for': xff,
        'x-real-ip': xri,
      },
      trusted_proxy: {
        ativo: trustedAtivo,
        headers: trustedHeaders,
        // Diagnóstico em português: o que isso significa para o limite.
        efeito: trustedAtivo
          ? 'IP real em uso: o limite conta por pessoa.'
          : 'IP do proxy em uso: o limite conta o site inteiro como um só cliente.',
      },
      total_linhas: linhas.length,
      linhas: linhas,
    })
  },
  $apis.requireAuth(),
)
