// 0062_remove_convite_teste_lote2.js
//
// Remove o convite de demonstração `ZN7K4QM2PX` criado pela 0060 para eu
// validar as telas do comando 2.
//
// POR QUE APAGAR: ele aparece no painel de presentes do dono e sujaria a
// contagem (1 convite, 0 conversões). Convite de teste com marcadores já
// gravados (`aberto_em`) é pior: parece um lead real que abriu e desistiu.
//
// O QUE TAMBÉM SAI: resgates e matrículas criados por ele — se eu tiver
// conseguido resgatar. Sem isso, sobraria uma matrícula de um aluno que não
// existe no painel.

migrate(
  (app) => {
    const CODIGO = 'ZN7K4QM2PX'

    let v = null
    try {
      v = app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: CODIGO })
    } catch (_) {}
    if (!v) {
      console.log('[ead][lote2] convite de teste ja nao existe')
      return
    }

    const id = v.id

    // resgates deste convite
    try {
      const rs = app.findRecordsByFilter('voucher_resgates', 'voucher = {:v}', '', 50, 0, { v: id })
      for (let i = 0; i < rs.length; i++) {
        // matrícula correspondente, se houver
        try {
          const u = String(rs[i].getString('user'))
          const c = String(rs[i].getString('curso'))
          const m = app.findFirstRecordByFilter(
            'matriculas',
            "user = {:u} && curso = {:c} && origem = 'cortesia'",
            { u: u, c: c },
          )
          app.delete(m)
        } catch (_) {}
        app.delete(rs[i])
      }
    } catch (errR) {
      console.log('[ead][lote2] falha ao limpar resgates: ' + errR.message)
    }

    try {
      app.delete(v)
      console.log('[ead][lote2] convite de teste removido: ' + CODIGO)
    } catch (err) {
      console.log('[ead][lote2] falha ao remover convite: ' + err.message)
    }
  },
  (app) => {
    // Não recriar convite de teste.
  },
)
