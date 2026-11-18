// aula-material-oculto.pb.js — esconde o PDF da aula de quem não tem matrícula.
//
// PENDÊNCIA RESOLVIDA (revisão externa, item 12; era o item 9 do
// GUIA-DESENVOLVEDOR-EAD): `material` e `material_url` apareciam na LISTAGEM
// PÚBLICA de `aulas`. Regra de linha não tem granularidade de campo: se a linha
// é visível, todos os campos vão junto — então o link do PDF (conteúdo pago)
// vazava junto com o título da aula.
//
// Hoje as 20 aulas estão com `material_url` vazio, então nada vazou de fato.
// Este hook fecha antes de o dono colar os links do Drive — é exatamente o
// momento em que o furo passaria a importar.
//
// COMO FUNCIONA: `onRecordEnrich` roda para cada registro devolvido pela API,
// depois das regras de acesso. Aqui o campo é ZERADO quando quem pede não é a
// equipe nem tem matrícula no curso daquela aula.
//
// QUEM VÊ O LINK:
//   * equipe (admin/suporte) e superusuário — precisam editar;
//   * aluno com matrícula ATIVA no curso da aula.
// O caminho oficial do aluno continua sendo /backend/v1/aulas/{slug}/material,
// que confere matrícula e devolve o link na hora — este hook fecha o atalho.
//
// ATENÇÃO AO ESCOPO: cada handler do JSVM roda isolado; nada de helper no topo.

onRecordEnrich((e) => {
  // Equipe e superusuário sempre veem.
  let equipe = false
  try {
    const auth = e.requestInfo().auth
    if (auth) {
      if (auth.collection().name === '_superusers') equipe = true
      else {
        const papel = String(auth.get('papel'))
        equipe = papel === 'admin' || papel === 'suporte'
      }
    }
  } catch (_) {}

  if (!equipe) {
    // Aula sem material: nada a esconder.
    const temMaterial =
      String(e.record.getString('material_url') || '').trim() !== '' ||
      String(e.record.getString('material') || '').trim() !== ''

    if (temMaterial) {
      let temMatricula = false
      try {
        const auth = e.requestInfo().auth
        if (auth) {
          // Curso da aula: aula → módulo → curso.
          let cursoId = ''
          try {
            const mod = $app.findRecordById('modulos', e.record.getString('modulo'))
            cursoId = mod.getString('curso')
          } catch (_) {}
          if (cursoId) {
            const ms = $app.findRecordsByFilter(
              'matriculas',
              "user = {:u} && curso = {:c} && status = 'ativa'",
              '',
              1,
              0,
              { u: auth.id, c: cursoId },
            )
            temMatricula = !!(ms && ms.length)
          }
        }
      } catch (_) {
        temMatricula = false
      }

      if (!temMatricula) {
        // Zera na SAÍDA. Não altera o registro no banco — quem tem acesso
        // continua recebendo o link pelo endpoint /material.
        e.record.set('material_url', '')
        e.record.set('material', '')
        e.record.set('tem_material', false)
      }
    }
  }

  e.next()
}, 'aulas')
