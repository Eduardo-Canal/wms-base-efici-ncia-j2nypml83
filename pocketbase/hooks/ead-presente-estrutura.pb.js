// ead-presente-estrutura.pb.js — GET /backend/v1/ead/presente-estrutura/{codigo}
//
// POR QUE ESTA ROTA EXISTE: a página do convite precisa listar os módulos e a
// contagem de aulas para quem ainda NÃO tem conta. `modulos` e `aulas` estão
// fechadas ao visitante (lote 1), então a vitrine sai por aqui.
//
// ⚠ POR QUE A URL NÃO É /presente/{codigo}/estrutura:
// tentei essa forma primeiro e o PocketBase roteava para o handler de
// `/presente/{codigo}` — o `{codigo}` engolia `ZZZZ/estrutura`? Não: o roteador
// casava o padrão mais curto primeiro e a rota aninhada nunca era alcançada
// (404 constante, confirmado no log de requests). Com a URL sem aninhamento o
// conflito desaparece. Registrado para não repetir.

routerAdd(
  'GET',
  '/backend/v1/ead/presente-estrutura/{codigo}',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
    const NAO_ENCONTRADO = {
      codigo: 'convite_indisponivel',
      mensagem: 'Este convite não está disponível.',
    }

    // Limite por IP (60/min).
    let ip = ''
    try {
      ip = String(e.realIP() || '')
    } catch (_) {}
    try {
      const agoraMs = Date.now()
      const chave = 'presente_estrutura|' + ip
      let reg = null
      try {
        reg = $app.findFirstRecordByFilter('limite_requisicoes', 'chave = {:c}', { c: chave })
      } catch (_) {}
      let contador = 1
      if (reg) {
        const s = reg.getString('janela_inicio')
        let inicio = 0
        if (s) {
          const t = new Date(String(s).replace(' ', 'T')).getTime()
          if (!isNaN(t)) inicio = t
        }
        if (inicio > 0 && agoraMs - inicio < 60000) contador = reg.getInt('contador') + 1
        else contador = 1
      }
      if (contador > 60)
        return e.json(429, {
          codigo: 'muitas_consultas',
          mensagem: 'Muitas consultas em pouco tempo. Aguarde um minuto.',
        })
      if (!reg) {
        const col = $app.findCollectionByNameOrId('limite_requisicoes')
        reg = new Record(col)
        reg.set('chave', chave)
        reg.set('janela_inicio', new Date().toISOString())
      } else if (contador === 1) {
        reg.set('janela_inicio', new Date().toISOString())
      }
      reg.set('contador', contador)
      $app.save(reg)
    } catch (errL) {
      console.log('[ead][presente-estrutura] limite: ' + errL.message)
    }

    const codigo = texto(e.request.pathValue('codigo')).toUpperCase().replace(/[\s-]/g, '')
    if (!codigo) return e.json(404, NAO_ENCONTRADO)

    let v = null
    try {
      v = $app.findFirstRecordByFilter('vouchers', 'codigo = {:c}', { c: codigo })
    } catch (_) {}
    if (!v || !v.getBool('ativo')) return e.json(404, NAO_ENCONTRADO)

    const validade = texto(v.getString('validade'))
    if (validade) {
      const quando = new Date(validade.replace(' ', 'T')).getTime()
      if (!isNaN(quando) && quando < Date.now()) return e.json(404, NAO_ENCONTRADO)
    }

    let cursoId = texto(v.getString('curso'))
    if (!cursoId) {
      try {
        const l = v.getStringSlice('cursos') || []
        if (l.length) cursoId = String(l[0])
      } catch (_) {}
    }
    let curso = null
    if (cursoId) {
      try {
        curso = $app.findRecordById('cursos', cursoId)
      } catch (_) {}
    }
    if (!curso) return e.json(404, NAO_ENCONTRADO)

    const modulos = []
    try {
      const mods = $app.findRecordsByFilter('modulos', 'curso = {:c}', 'ordem', 200, 0, {
        c: curso.id,
      })
      for (let i = 0; i < mods.length; i++) {
        const as = $app.findRecordsByFilter(
          'aulas',
          'modulo = {:m} && publicado = true',
          'ordem',
          500,
          0,
          { m: mods[i].id },
        )
        // Só a contagem: a vitrine mostra a divisão do curso, não o conteúdo
        // aula por aula (título de aula é do aluno, não do visitante).
        modulos.push({
          id: mods[i].id,
          titulo: mods[i].getString('titulo'),
          ordem: mods[i].getInt('ordem'),
          aulas: as.length,
        })
      }
    } catch (errM) {
      console.log('[ead][presente-estrutura] falha: ' + errM.message)
    }

    return e.json(200, { curso: texto(curso.getString('titulo')), modulos: modulos })
  },
  // Público: é a mesma página do convite.
)
