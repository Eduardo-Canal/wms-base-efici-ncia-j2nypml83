// 0041_limpa_curso_teste.js
//
// Remove o CURSO DE TESTE que eu criei em 17/11 para validar o cadastro de
// curso pelo painel: slug `tst-teste-diagnostico-da-operacao`, mais o módulo
// (`tst-m01`), a aula (`tst-a01`) e o produto
// (`curso-teste-diagnostico-da-operacao`).
//
// POR QUE POR MIGRATION: `cursos`, `modulos` e `produtos` têm createRule e
// deleteRule nulos — só o servidor apaga. E não existe endpoint de exclusão de
// curso de propósito (apagar curso apaga o acesso de quem pagou).
//
// PROTEÇÃO: apaga só o slug exato com o prefixo de teste. Se o dono já tiver
// criado um curso de verdade, nada aqui toca nele.
migrate(
  (app) => {
    const slugCurso = 'tst-teste-diagnostico-da-operacao'

    // 1. acha o curso de teste
    let curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: slugCurso })
    } catch (_) {
      console.log('[ead] limpa curso teste: não existe (nada a fazer)')
      return
    }
    if (!curso) return

    const cursoId = curso.id

    // 2. aulas do curso
    try {
      const mods = app.findRecordsByFilter('modulos', 'curso = {:c}', '', 100, 0, { c: cursoId })
      for (let i = 0; i < mods.length; i++) {
        const aulas = app.findRecordsByFilter('aulas', 'modulo = {:m}', '', 200, 0, {
          m: mods[i].id,
        })
        for (let k = 0; k < aulas.length; k++) {
          // mídia primeiro (relação da aula)
          try {
            const mid = app.findFirstRecordByFilter('aulas_midia', 'aula = {:a}', {
              a: aulas[k].id,
            })
            if (mid) app.delete(mid)
          } catch (_) {}
          // progresso, se houver
          try {
            const prog = app.findRecordsByFilter('progresso_aulas', 'aula = {:a}', '', 500, 0, {
              a: aulas[k].id,
            })
            for (let p = 0; p < prog.length; p++) app.delete(prog[p])
          } catch (_) {}
          app.delete(aulas[k])
        }
        app.delete(mods[i])
      }
    } catch (err) {
      console.log('[ead] limpa curso teste: falhou ao limpar aulas: ' + err.message)
    }

    // 3. produto ligado ao curso
    try {
      const prods = app.findRecordsByFilter('produtos', 'cursos ~ {:c}', '', 20, 0, { c: cursoId })
      for (let i = 0; i < prods.length; i++) {
        if (String(prods[i].getString('slug')).indexOf('curso-teste-') === 0) {
          app.delete(prods[i])
          console.log('[ead] produto de teste removido: ' + prods[i].getString('slug'))
        }
      }
    } catch (_) {}

    // 4. matrículas (nenhuma deve existir, mas não deixar órfão)
    try {
      const mats = app.findRecordsByFilter('matriculas', 'curso = {:c}', '', 100, 0, { c: cursoId })
      for (let i = 0; i < mats.length; i++) app.delete(mats[i])
    } catch (_) {}

    // 5. o curso
    try {
      app.delete(curso)
      console.log('[ead] curso de teste removido: ' + slugCurso)
    } catch (err) {
      console.log('[ead] limpa curso teste: falhou ao apagar curso: ' + err.message)
    }
  },
  (app) => {
    // Irreversível de propósito: dado de teste não volta.
  },
)
