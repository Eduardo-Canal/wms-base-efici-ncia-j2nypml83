// 0049_carga_horaria_2h.js
//
// PEDIDO DO DONO (18/11, item 9): "ajuste o certificado para 2 horas e mostre
// na página do curso 'Carga horária: 2 h (vídeos e exercícios de fixação)'".
//
// CONTEXTO QUE MOTIVOU: ao sincronizar as durações pelo Bunny, descobri que o
// curso soma 75,2 minutos (1,3 h) — as aulas têm 3 a 5 min cada. O certificado
// estava com `cert_carga_horas = 18`, herdado de quando o plano previa vídeos
// longos. Um certificado de 18 h para 1,3 h de vídeo é o tipo de dado que o RH
// confere e devolve.
//
// O QUE AJUSTA:
//   * `cert_carga_horas` = 2 (número que vai no documento)
//   * `cert_texto` = menciona vídeos e exercícios de fixação, que é a
//     justificativa da diferença entre 1,3 h de vídeo e 2 h declaradas
//   * `carga_min` = 120 (a mesma carga em minutos, usada na página do curso)
//
// O texto da página do curso ("Carga horária: 2 h ...") vem de `carga_min`
// formatado — não é migration, é a tela lendo o dado.

migrate(
  (app) => {
    let curso = null
    try {
      curso = app.findFirstRecordByFilter('cursos', 'slug = {:s}', {
        s: 'fund-wms-fundamentos',
      })
    } catch (_) {}
    if (!curso) {
      console.log('[ead] curso fund-wms-fundamentos nao encontrado; nada alterado')
      return
    }

    try {
      curso.set('cert_carga_horas', 2)
      curso.set('carga_min', 120)
      // Texto do certificado: explica de onde vem a carga declarada.
      curso.set(
        'cert_texto',
        'Certificamos que o aluno concluiu o curso, com a carga horária abaixo, ' +
          'incluindo as videoaulas e os exercícios de fixação de cada aula.',
      )
      app.save(curso)
      console.log('[ead] carga horaria do certificado ajustada para 2 h (120 min)')
    } catch (err) {
      console.log('[ead] falha ao ajustar carga horaria: ' + err.message)
    }
  },
  (app) => {
    // Reverter para 18 h não faz sentido: era o valor incorreto.
  },
)
