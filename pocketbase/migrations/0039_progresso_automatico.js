// 0039_progresso_automatico.js
//
// DECISÃO DO DONO (16/11 17:03): "3 - vamos na sua recomendação, a A".
// (a) = conclusão AUTOMÁTICA por tempo assistido (~90% do vídeo), padrão de
// mercado (Insight Academy/Panda, EAD Plataforma).
//
// O QUE MUDA E POR QUÊ:
//
// 1. O aluno deixa de poder escrever em `progresso_aulas`.
//    Antes: createRule = "user = @request.auth.id && aula.publicado = true" e
//    updateRule = "user = @request.auth.id". Ou seja: o aluno chamava a API
//    REST e marcava as 20 aulas como concluídas em 2 minutos — o certificado
//    atestava um clique. Agora quem escreve é só o servidor, pelo endpoint
//    /backend/v1/aula/{slug}/progresso, que mede tempo real assistido.
//
// 2. Campos para medir TEMPO, não posição.
//    Posição sozinha engana: arrastar a barra para o fim põe `seconds` no
//    final sem ninguém ter assistido. Por isso guardamos:
//      - segundos_assistidos: soma de tempo REAL de reprodução (o que conta);
//      - posicao_seg: onde o vídeo está (já existia) — serve para detectar
//        salto e para o aluno retomar de onde parou;
//      - ultimo_report_em: quando o player falou pela última vez; é o teto do
//        quanto o tempo pode ter avançado entre dois reports;
//      - duracao_seg: duração efetiva usada no cálculo, para auditoria.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('progresso_aulas')

    if (!col.fields.getByName('segundos_assistidos')) {
      col.fields.add(new NumberField({ name: 'segundos_assistidos', required: false, min: 0 }))
    }
    if (!col.fields.getByName('ultimo_report_em')) {
      col.fields.add(new DateField({ name: 'ultimo_report_em', required: false }))
    }
    if (!col.fields.getByName('duracao_seg')) {
      col.fields.add(new NumberField({ name: 'duracao_seg', required: false, min: 0 }))
    }

    // Fecha a escrita do aluno. Só o servidor grava progresso.
    col.createRule = null
    col.updateRule = null

    // O aluno continua LENDO o próprio progresso (a tela precisa).
    if (!col.listRule) col.listRule = 'user = @request.auth.id'
    if (!col.viewRule) col.viewRule = 'user = @request.auth.id'

    app.save(col)
    console.log('[ead] progresso_aulas: escrita fechada ao cliente; campos de tempo criados')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('progresso_aulas')
      col.createRule = 'user = @request.auth.id && aula.publicado = true'
      col.updateRule = 'user = @request.auth.id'
      app.save(col)
    } catch (_) {}
  },
)
