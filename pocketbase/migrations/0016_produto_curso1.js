// 0016_produto_curso1 — cria o produto que vende o Curso 1.
// Preço: R$ 197,00 = 19700 centavos (definido pelo Eduardo em 15/11).
// ativo = true porque o preço existe; a VENDA real ainda depende do
// MP_ACCESS_TOKEN estar configurado, e isso o checkout responde com 503
// enquanto faltar — sem vender errado.
migrate(
  (app) => {
    var ja = null
    try {
      ja = app.findFirstRecordByFilter('produtos', 'slug = {:s}', { s: 'curso-fundamentos' })
    } catch (e) {}
    if (ja) return
    try {
      var cursos = app.findFirstRecordByFilter('cursos', 'slug = {:s}', {
        s: 'fund-wms-fundamentos',
      })
      var col = app.findCollectionByNameOrId('produtos')
      var p = new Record(col)
      p.set('slug', 'curso-fundamentos')
      p.set('titulo', 'Curso WMS: Fundamentos e Integrações')
      p.set(
        'descricao',
        'Curso 1 de 3. 20 aulas em vídeo, gravadas por Eduardo Canal, baseadas no Volume 1 do Guia Masterclass de Implementação WMS. Acesso imediato após o pagamento.',
      )
      p.set('preco_centavos', 19700)
      p.set('moeda', 'BRL')
      p.set('cursos', [cursos.id])
      p.set('ativo', true)
      p.set('ordem', 1)
      app.save(p)
    } catch (e) {}
  },
  (app) => {
    try {
      var x = app.findFirstRecordByFilter('produtos', 'slug = {:s}', { s: 'curso-fundamentos' })
      if (x) app.delete(x)
    } catch (e) {}
  },
)
