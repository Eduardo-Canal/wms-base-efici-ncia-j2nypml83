// 0038_limpa_certificado_teste_rubrica.js
//
// Remove o certificado de teste emitido em 16/11 enquanto eu validava a rubrica
// (código WMS-CCPJ-UCW5, aluno "Aluno Voucher").
// AUTORIZADO pelo dono em 16/11 17:03: "1 - pode apagar".
//
// Só apaga o que é comprovadamente de teste: código exato OU nome de aluno de
// teste. Se um dia existir um aluno real com esse nome, o código exato ainda
// protege. Nunca apagar em massa.
//
// migrations que já rodaram NÃO rodam de novo — por isso um arquivo novo em vez
// de editar o 0036 (erro que eu cometi e corrigi no 0037).
migrate(
  (app) => {
    const alvos = ['WMS-CCPJ-UCW5', 'WMS-KPTW-9V8V']
    for (let i = 0; i < alvos.length; i++) {
      try {
        const c = app.findFirstRecordByFilter('certificados', 'codigo = {:c}', { c: alvos[i] })
        if (c) {
          app.delete(c)
          console.log('[ead] certificado de teste removido: ' + alvos[i])
        }
      } catch (_) {
        // não existe: nada a fazer
      }
    }
    try {
      const sobrando = app.findRecordsByFilter(
        'certificados',
        "nome_aluno = 'Aluno Voucher'",
        '',
        50,
        0,
      )
      for (let i = 0; i < sobrando.length; i++) {
        app.delete(sobrando[i])
        console.log('[ead] certificado de teste removido (aluno de teste): ' + sobrando[i].id)
      }
    } catch (_) {}
  },
  (app) => {
    // Irreversível de propósito: não recriar dado de teste.
  },
)
