// 0014_publica_para_teste — publica curso e aula 01 no PREVIEW para validar o
// caminho liberado. NÃO é decisão de ir ao ar: produção só muda na publicação,
// e o Eduardo decide isso. A aula fica com duracao_seg > 0 (vídeo de teste).
migrate(
  (app) => {
    try {
      var c = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
      if (c) {
        c.set('publicado', true)
        app.save(c)
      }
    } catch (e) {}
    try {
      var a = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a01-desafios-logistica-in-house',
      })
      if (a) {
        a.set('publicado', true)
        a.set('duracao_seg', 185)
        app.save(a)
      }
    } catch (e) {}
  },
  (app) => {
    try {
      var c = app.findFirstRecordByFilter('cursos', 'slug = {:s}', { s: 'fund-wms-fundamentos' })
      if (c) {
        c.set('publicado', false)
        app.save(c)
      }
    } catch (e) {}
    try {
      var a = app.findFirstRecordByFilter('aulas', 'slug = {:s}', {
        s: 'fund-a01-desafios-logistica-in-house',
      })
      if (a) {
        a.set('publicado', false)
        app.save(a)
      }
    } catch (e) {}
  },
)
