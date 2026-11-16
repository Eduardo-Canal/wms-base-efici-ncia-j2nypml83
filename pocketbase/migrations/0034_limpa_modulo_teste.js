// 0034_limpa_modulo_teste.js
//
// REMOÇÃO DE UM REGISTRO DE TESTE que eu mesmo criei ao validar a tela de
// conteúdo (16/11 16:05). Nome e slug são exatamente os que usei no teste
// ("Modulo de Teste Automatizado" / fund-m07), então isto não toca em nada
// real: se o módulo não existir, a migration não faz nada.
//
// Por que migration e não delete pela API: `modulos` tem createRule/updateRule/
// deleteRule nulos, então apagar por HTTP exige superuser — que nós não temos
// exposto. Migration roda como o próprio app.
migrate(
  (app) => {
    try {
      const m = app.findFirstRecordByFilter('modulos', "slug = 'fund-m07'")
      if (m && String(m.getString('titulo')) === 'Modulo de Teste Automatizado') {
        // Só apaga se não sobrou aula dentro (senão perde conteúdo).
        const aulas = app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 10, 0, { m: m.id })
        if (!aulas || aulas.length === 0) {
          app.delete(m)
          console.log('[ead] modulo de teste removido')
        } else {
          console.log('[ead] modulo de teste tem aulas: nao removido')
        }
      }
    } catch (_) {
      // não existe: nada a fazer
    }
  },
  (app) => {
    // Reverter não recria dado de teste.
  },
)
