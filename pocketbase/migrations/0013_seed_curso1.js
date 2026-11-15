// 0013_seed_curso1 — cria o Curso 1 (rascunho) e o módulo 1, para o preview ter
// o que mostrar. NÃO publica curso nem aula: o Eduardo decide quando vai ao ar.
// Idempotente: se o slug já existe, não duplica.
migrate(
  (app) => {
    var cursos = null
    try {
      cursos = app.findCollectionByNameOrId('cursos')
    } catch (e) {
      return
    }

    var ja = null
    try {
      ja = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
    } catch (e) {}
    if (ja) return

    var curso = new Record(cursos)
    curso.set('slug', 'fund-wms-fundamentos')
    curso.set('titulo', 'WMS: Fundamentos e Integrações')
    curso.set(
      'resumo_1linha',
      'Entenda o mapa de sistemas da operação e o que exigir de um WMS antes de comprar.',
    )
    curso.set(
      'resultado_esperado',
      'Ao final, você sabe dizer quem é o sistema origem de cada integração, o que um WMS precisa ter e como decidir entre on-premise e SaaS.',
    )
    curso.set(
      'descricao',
      'Curso baseado no Volume 1 do Guia Masterclass de Implementação WMS. Percorre os desafios da logística in house, o mapa de sistemas (ERP, TMS, OMS, VMI, automação), as funcionalidades que todo WMS precisa ter e a integração mais crítica da operação: ERP x WMS.',
    )
    curso.set('publicado', false)
    curso.set('ordem', 1)
    curso.set('carga_min', 0)
    app.save(curso)

    var modulos = app.findCollectionByNameOrId('modulos')
    var mod = new Record(modulos)
    mod.set('curso', curso.id)
    mod.set('titulo', 'Por que a logística in house trava')
    mod.set('slug', 'fund-m01-logistica-in-house')
    mod.set('ordem', 1)
    app.save(mod)

    var aulas = app.findCollectionByNameOrId('aulas')
    var a1 = new Record(aulas)
    a1.set('modulo', mod.id)
    a1.set('slug', 'fund-a01-desafios-logistica-in-house')
    a1.set('titulo', 'Os cinco pontos onde a operação in house perde dinheiro')
    a1.set('numero', 'Aula 01')
    a1.set('ordem', 1)
    a1.set('publicado', false)
    a1.set('amostra', true)
    a1.set('duracao_seg', 0)
    a1.set(
      'pergunta_fixacao',
      'Qual dos cinco pontos você consegue medir hoje na sua operação — e qual você só acha que sabe?',
    )
    app.save(a1)
  },
  (app) => {
    try {
      var a = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a01-desafios-logistica-in-house',
      })
      if (a) app.delete(a)
    } catch (e) {}
    try {
      var m = app.findFirstRecordByFilter('modulos', 'slug = {:s}', {
        s: 'fund-m01-logistica-in-house',
      })
      if (m) app.delete(m)
    } catch (e2) {}
    try {
      var c = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
      if (c) app.delete(c)
    } catch (e3) {}
  },
)
