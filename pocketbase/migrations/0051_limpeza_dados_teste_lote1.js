// 0051_limpeza_dados_teste_lote1.js
//
// ITEM 7 DA REVISAO (18/11): dev e producao usam o mesmo banco, entao os testes
// deste lote gravaram dado real. Esta migration apaga tudo que e de teste:
//   * vouchers do teste de concorrencia e seus resgates;
//   * matriculas e progresso das contas de teste;
//   * contadores de limite_requisicoes;
//   * as contas de teste (incluindo teste.admin.lote1).
//
// NAO TOCA: curso, modulos, aulas, produto, certificado, conta do dono.

migrate(
  (app) => {
    const emailsTeste = [
      'aluno.voucher@exemplo.com',
      'cadastro.teste.xyz@zionlogtec.com.br',
      'teste.admin.lote1@exemplo.com',
    ]

    const ids = []
    for (let i = 0; i < emailsTeste.length; i++) {
      let u = null
      try {
        u = app.findAuthRecordByEmail('_pb_users_auth_', emailsTeste[i])
      } catch (_) {}
      if (u) ids.push(u.id)
    }
    try {
      const porNome = app.findRecordsByFilter('_pb_users_auth_', "name = 'Aluno Dois'", '', 10, 0)
      for (let i = 0; i < porNome.length; i++) ids.push(porNome[i].id)
    } catch (_) {}

    let progApagado = 0
    let matApagada = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        const p = app.findRecordsByFilter('progresso_aulas', 'user = {:u}', '', 500, 0, { u: ids[i] })
        for (let k = 0; k < p.length; k++) {
          app.delete(p[k])
          progApagado++
        }
      } catch (_) {}
      try {
        const m = app.findRecordsByFilter('matriculas', 'user = {:u}', '', 200, 0, { u: ids[i] })
        for (let k = 0; k < m.length; k++) {
          app.delete(m[k])
          matApagada++
        }
      } catch (_) {}
      try {
        const r = app.findRecordsByFilter('voucher_resgates', 'user = {:u}', '', 200, 0, { u: ids[i] })
        for (let k = 0; k < r.length; k++) app.delete(r[k])
      } catch (_) {}
    }

    let vouchersApagados = 0
    try {
      const vs = app.findRecordsByFilter('vouchers', "descricao ~ 'teste concorrencia lote1'", '', 50, 0)
      for (let i = 0; i < vs.length; i++) {
        try {
          const rr = app.findRecordsByFilter('voucher_resgates', 'voucher = {:v}', '', 200, 0, { v: vs[i].id })
          for (let k = 0; k < rr.length; k++) app.delete(rr[k])
        } catch (_) {}
        app.delete(vs[i])
        vouchersApagados++
      }
    } catch (_) {}

    let limitesApagados = 0
    try {
      const lim = app.findRecordsByFilter('limite_requisicoes', "id != ''", '', 500, 0)
      for (let i = 0; i < lim.length; i++) {
        app.delete(lim[i])
        limitesApagados++
      }
    } catch (_) {}

    let contasApagadas = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        const u = app.findRecordById('_pb_users_auth_', ids[i])
        app.delete(u)
        contasApagadas++
      } catch (_) {}
    }

    console.log(
      '[ead][limpeza lote1] contas: ' + contasApagadas + ' | matriculas: ' + matApagada +
      ' | progresso: ' + progApagado + ' | vouchers: ' + vouchersApagados + ' | contadores: ' + limitesApagados,
    )
  },
  (app) => {
    // Dado de teste nao volta.
  },
)
