// 0051_limpeza_dados_teste_lote1.js
//
// ITEM 7 DA REVISÃO (18/11): "dev e produção usam o mesmo banco, então os
// testes deste lote gravaram dado real. Liste tudo o que foi criado e apague."
//
// O QUE ESTA MIGRATION LIMPA (tudo comprovadamente de teste):
//   * vouchers criados para o teste de concorrência (descrição "teste concorrencia lote1");
//   * as matrículas e resgates desses vouchers;
//   * matrículas e progresso das 3 contas de teste (Aluno Voucher, Aluno Dois,
//     Cadastro Teste) — nenhuma é cliente real;
//   * linhas de `limite_requisicoes` (contadores de teste);
//   * a conta `teste.admin.lote1@exemplo.com` criada para este lote;
//   * as 3 contas de aluno de teste.
//
// O QUE NÃO TOCA: curso, módulos, aulas, produto, certificado, conta do dono.
//
// LIÇÃO REGISTRADA: de agora em diante, conta de teste nasce com e-mail
// começando em "teste" e é apagada ao fim da rodada — este lote usou
// @exemplo.com, que é ambíguo.

migrate(
  (app) => {
    const emailsTeste = [
      'aluno.voucher@exemplo.com',
      'cadastro.teste.xyz@zionlogtec.com.br',
      'teste.admin.lote1@exemplo.com',
    ]

    // ---- 1. usuários de teste ----
    const ids = []
    for (let i = 0; i < emailsTeste.length; i++) {
      let u = null
      try {
        u = app.findAuthRecordByEmail('_pb_users_auth_', emailsTeste[i])
      } catch (_) {}
      if (u) ids.push(u.id)
    }

    // "Aluno Dois" não tem e-mail exposto na API; busca por nome.
    try {
      const porNome = app.findRecordsByFilter('_pb_users_auth_', "name = 'Aluno Dois'", '', 10, 0)
      for (let i = 0; i < porNome.length; i++) ids.push(porNome[i].id)
    } catch (_) {}

    // ---- 2. progresso e matrícula dos usuários de teste ----
    let progApagado = 0
    let matApagada = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        const p = app.findRecordsByFilter('progresso_aulas', 'user = {:u}', '', 500, 0, {
          u: ids[i],
        })
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
        const r = app.findRecordsByFilter('voucher_resgates', 'user = {:u}', '', 200, 0, {
          u: ids[i],
        })
        for (let k = 0; k < r.length; k++) app.delete(r[k])
      } catch (_) {}
    }

    // ---- 3. vouchers de teste ----
    let vouchersApagados = 0
    try {
      const vs = app.findRecordsByFilter(
        'vouchers',
        "descricao ~ 'teste concorrencia lote1'",
        '',
        50,
        0,
      )
      for (let i = 0; i < vs.length; i++) {
        // resgates primeiro (relação)
        try {
          const rr = app.findRecordsByFilter('voucher_resgates', 'voucher = {:v}', '', 200, 0, {
            v: vs[i].id,
          })
          for (let k = 0; k < rr.length; k++) app.delete(rr[k])
        } catch (_) {}
        app.delete(vs[i])
        vouchersApagados++
      }
    } catch (_) {}

    // ---- 4. contadores do limitador ----
    let limitesApagados = 0
    try {
      const lim = app.findRecordsByFilter('limite_requisicoes', "id != ''", '', 500, 0)
      for (let i = 0; i < lim.length; i++) {
        app.delete(lim[i])
        limitesApagados++
      }
    } catch (_) {}

    // ---- 5. contas ----
    let contasApagadas = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        const u = app.findRecordById('_pb_users_auth_', ids[i])
        app.delete(u)
        contasApagadas++
      } catch (_) {}
    }

    console.log(
      '[ead][limpeza lote1] contas: ' +
        contasApagadas +
        ' | matriculas: ' +
        matApagada +
        ' | progresso: ' +
        progApagado +
        ' | vouchers: ' +
        vouchersApagados +
        ' | contadores: ' +
        limitesApagados,
    )
  },
  (app) => {
    // Dado de teste não volta.
  },
)
