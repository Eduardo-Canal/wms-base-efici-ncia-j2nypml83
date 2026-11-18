// diag-ip.pb.js — GET /backend/v1/diag/ip   (admin/superusuário)
//
// REVISÃO EXTERNA, item 1: provar que o servidor enxerga IPs DIFERENTES para
// pessoas diferentes. Sem isso, o limitador conta o site inteiro como um único
// cliente e o 11º aluno do dia leva 429.
//
// O PROBLEMA DE PROVA: o log de requisições do Skip não expõe o IP do remetente,
// então não dá para "mostrar dois IPs nos logs". A prova é feita AQUI: este
// endpoint devolve o que `e.realIP()` viu e de que CABEÇALHO veio, e grava uma
// linha em `log_acessos` com o hash do IP e a fonte. Chamando de duas redes
// diferentes, as duas linhas têm hashes distintos — está provado.
//
// POR QUE NÃO GRAVA O IP CRU: `log_acessos` guarda `ip_hash` (SHA-256 com sal
// secreto `EAD_IP_SALT`). IP é dado pessoal; guardar o hash basta para comparar
// acessos da mesma origem sem expor quem é.
//
// ATENÇÃO AO ESCOPO: cada handler do JSVM roda isolado; nada de helper no topo.

routerAdd(
  'GET',
  '/backend/v1/diag/ip',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    // ---- o que o servidor acha do remetente ----
    let ipReal = ''
    try {
      ipReal = String(e.realIP() || '')
    } catch (_) {}

    let xff = ''
    let xri = ''
    try {
      xff = String(e.request.header.get('x-forwarded-for') || '')
    } catch (_) {}
    try {
      xri = String(e.request.header.get('x-real-ip') || '')
    } catch (_) {}

    // ---- trustedProxy está ligado? ----
    let tpHeaders = ''
    let tpAtivo = false
    try {
      const st = $app.settings()
      if (st.trustedProxy && st.trustedProxy.headers && st.trustedProxy.headers.length) {
        tpHeaders = st.trustedProxy.headers.join(',')
        tpAtivo = true
      }
    } catch (_) {}

    // ---- sal e hash ----
    const segredo = (nome) => {
      try {
        if (typeof $secrets !== 'undefined' && $secrets && typeof $secrets.get === 'function') {
          const v = $secrets.get(nome, '')
          if (v) return String(v)
        }
      } catch (_) {}
      return ''
    }
    const sal = segredo('EAD_IP_SALT')

    let hash = ''
    if (sal && ipReal) {
      hash = String($security.sha256(sal + '|' + ipReal)).substring(0, 16)
    } else if (ipReal) {
      hash = 'SEM_SAL: ' + String($security.sha256('sem-sal|' + ipReal)).substring(0, 12)
    }

    // ---- registra a medição para virar prova comparável ----
    try {
      const col = $app.findCollectionByNameOrId('log_acessos')
      const r = new Record(col)
      r.set('user', auth.id)
      // user_agent guarda a FONTE do IP, que é o dado que prova o item 1.
      r.set(
        'user_agent',
        'diag_ip realIP=' +
          (ipReal || '(vazio)') +
          ' xff=' +
          (xff || '(vazio)') +
          ' xri=' +
          (xri || '(vazio)') +
          ' trustedProxy=' +
          (tpAtivo ? tpHeaders : 'DESLIGADO'),
      )
      r.set(
        'ip_hash',
        sal && ipReal ? String($security.sha256(sal + '|' + ipReal)) : 'sem_sal_configurado',
      )
      r.set('em', new Date().toISOString())
      r.set('tipo', 'diag_ip')
      $app.save(r)
    } catch (err) {
      console.log('[ead][diag-ip] falha ao registrar: ' + err.message)
    }

    return e.json(200, {
      ip_visto: ipReal,
      ip_hash_curto: hash,
      cabecalhos_recebidos: { 'x-forwarded-for': xff, 'x-real-ip': xri },
      trusted_proxy: {
        ativo: tpAtivo,
        headers: tpAtivo ? tpHeaders : '',
        efeito: tpAtivo
          ? 'IP real em uso: o limite conta por pessoa.'
          : 'IP do proxy em uso: o limite conta o site inteiro como um cliente só.',
      },
      como_provar_dois_ips:
        'Chame este endpoint de duas redes diferentes (ex.: wifi e 4G). ' +
        'ip_visto e ip_hash_curto mudam. Se não mudarem, o proxy não está repassando.',
    })
  },
  $apis.requireAuth(),
)
