// 0015_aula_nao_amostra — cria a Aula 02 (não amostra, publicada, sem vídeo)
// para testar que quem não tem matrícula recebe 403 sem_matricula de verdade.
migrate(
  (app) => {
    var ja = null
    try {
      ja = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a02-papel-da-tecnologia',
      })
    } catch (e) {}
    if (ja) return
    try {
      var mod = app.findFirstRecordByFilter('modulos', 'slug = {:s}', {
        s: 'fund-m01-logistica-in-house',
      })
      var aulas = app.findCollectionByNameOrId('aulas')
      var a = new Record(aulas)
      a.set('modulo', mod.id)
      a.set('slug', 'fund-a02-papel-da-tecnologia')
      a.set('titulo', 'O papel da tecnologia na logística')
      a.set('numero', 'Aula 02')
      a.set('ordem', 2)
      a.set('publicado', true)
      a.set('amostra', false)
      a.set('duracao_seg', 360)
      app.save(a)
    } catch (e) {}
  },
  (app) => {
    try {
      var x = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a02-papel-da-tecnologia',
      })
      if (x) app.delete(x)
    } catch (e) {}
  },
)
