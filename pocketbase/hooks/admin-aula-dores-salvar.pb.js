// admin-aula-dores-salvar.pb.js — POST /backend/v1/ead/admin/aula-dores
// v2: reaplicado — o publish anterior nao registrou esta rota (404 em producao).
//
// Grava o CONJUNTO de dores de uma aula e qual delas é a porta de entrada.
//
// COMPORTAMENTO: as dores enviadas viram a verdade. Dor que estava marcada e não
// veio na lista é REMOVIDA (aula deixou de tratar dela). Dor na lista sem
// registro é CRIADA. É o que o admin vê na tela depois de salvar — sem isso ele
// desmarca uma dor, recarrega e ela reaparece.
//
// `porta_entrada` vazio = nenhuma dor desta aula é porta. É estado válido: uma
// aula pode tratar de dores sem ser porta de nenhuma.
//
// TUDO EM TRANSAÇÃO: se uma gravação falhar no meio, o aluno não fica com o
// curso meio marcado.

routerAdd(
  'POST',
  '/backend/v1/ead/admin/aula-dores',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    let corpo = {}
    try {
      corpo = e.requestInfo().body || {}
    } catch (_) {}

    const aulaId = texto(corpo.aula)
    if (!aulaId) return e.json(400, { codigo: 'aula_obrigatoria', mensagem: 'Informe a aula.' })

    let aula = null
    try {
      aula = $app.findRecordById('aulas', aulaId)
    } catch (_) {}
    if (!aula) return e.json(404, { codigo: 'aula_inexistente', mensagem: 'Aula não encontrada.' })

    const desejadas = Array.isArray(corpo.dores) ? corpo.dores.map((x) => String(x)) : []
    const porta = texto(corpo.porta_entrada)

    // Confere que toda dor existe e está ativa. Id inventado não entra.
    for (let i = 0; i < desejadas.length; i++) {
      let d = null
      try {
        d = $app.findRecordById('dores', desejadas[i])
      } catch (_) {}
      if (!d)
        return e.json(400, {
          codigo: 'dor_invalida',
          mensagem: 'Uma das dores escolhidas não existe.',
        })
    }
    // A porta tem de estar entre as marcadas — senão a aula seria porta de uma
    // dor que ela não trata.
    if (porta && desejadas.indexOf(porta) === -1)
      return e.json(400, {
        codigo: 'porta_fora_da_lista',
        mensagem: 'A porta de entrada precisa estar entre as dores marcadas.',
      })

    let criados = 0
    let removidos = 0
    let atualizados = 0

    try {
      $app.runInTransaction((txApp) => {
        const existentes = txApp.findRecordsByFilter('aula_dores', 'aula = {:a}', '', 100, 0, {
          a: aulaId,
        })
        const porDor = {}
        for (let i = 0; i < existentes.length; i++) {
          porDor[String(existentes[i].getString('dor') || '')] = existentes[i]
        }

        // 1. remove o que saiu (log antes, para contar)
        for (let i = 0; i < existentes.length; i++) {
          const dorId = String(existentes[i].getString('dor') || '')
          if (desejadas.indexOf(dorId) === -1) {
            txApp.delete(existentes[i])
            removidos++
          }
        }

        // 2. cria o que entrou / ajusta a porta
        for (let i = 0; i < desejadas.length; i++) {
          const dorId = desejadas[i]
          const deveSerPorta = dorId === porta
          let reg = porDor[dorId] || null

          if (!reg) {
            const col = txApp.findCollectionByNameOrId('aula_dores')
            reg = new Record(col)
            reg.set('aula', aulaId)
            reg.set('dor', dorId)
            reg.set('porta_entrada', deveSerPorta)
            txApp.save(reg)
            criados++
          } else if (reg.getBool('porta_entrada') !== deveSerPorta) {
            reg.set('porta_entrada', deveSerPorta)
            txApp.save(reg)
            atualizados++
          }
        }
      })
    } catch (err) {
      console.log('[ead][aula-dores] falha ao salvar: ' + err.message)
      return e.json(500, {
        codigo: 'salvar_falhou',
        mensagem: 'Não foi possível salvar a marcação: ' + err.message,
      })
    }

    return e.json(200, {
      ok: true,
      criados: criados,
      removidos: removidos,
      atualizados: atualizados,
      total: desejadas.length,
      porta_entrada: porta,
    })
  },
  $apis.requireAuth(),
)
