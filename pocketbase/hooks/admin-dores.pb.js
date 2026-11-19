// admin-dores.pb.js — catálogo de dores e marcação nas aulas (comando 3, item 2)
// v2: reaplicado para o deploy levar o arquivo (o publish anterior não o pegou).
//
//   GET  /backend/v1/ead/admin/dores            → dores + contagem de aulas
//   POST /backend/v1/ead/admin/dores            → cria/edita dor
//   GET  /backend/v1/ead/admin/aula-dores?aula= → dores de uma aula + porta
//   POST /backend/v1/ead/admin/aula-dores       → grava a marcação da aula
//
// ⚠ UM routerAdd POR ARQUIVO é a regra do JSVM deste projeto. Por isso as quatro
// rotas vivem em DOIS arquivos: este (dores) e admin-aula-dores.pb.js.
//
// POR QUE UM ENDPOINT E NÃO A API DIRETA DAS COLEÇÕES:
//   * `dores`/`aula_dores` têm createRule de admin, então a tela poderia
//     escrever. Mas a marcação da aula é um CONJUNTO (dores + porta), e gravar
//     item por item pela API deixaria o meio-caminho visível: o aluno abriria o
//     curso com metade das dores marcadas;
//   * aqui a gravação é atômica dentro de `runInTransaction`.

routerAdd(
  'GET',
  '/backend/v1/ead/admin/dores',
  (e) => {
    const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
    void texto

    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    // Contagem de aulas por dor (todas as aulas, não só publicadas: o painel
    // mostra o que está no currículo).
    const contagem = {}
    try {
      const vinculos = $app.findRecordsByFilter('aula_dores', "id != ''", '', 3000, 0)
      for (let i = 0; i < vinculos.length; i++) {
        const d = String(vinculos[i].getString('dor') || '')
        if (!d) continue
        contagem[d] = (contagem[d] || 0) + 1
      }
    } catch (err) {
      console.log('[ead][admin-dores] falha ao contar: ' + err.message)
    }

    const lista = []
    try {
      const ds = $app.findRecordsByFilter('dores', "id != ''", 'ordem', 200, 0)
      for (let i = 0; i < ds.length; i++) {
        lista.push({
          id: ds[i].id,
          nome: ds[i].getString('nome'),
          ativo: ds[i].getBool('ativo'),
          texto: ds[i].getString('texto_prediagnostico'),
          aulas: contagem[ds[i].id] || 0,
        })
      }
    } catch (err2) {
      console.log('[ead][admin-dores] falha ao listar: ' + err2.message)
    }

    return e.json(200, { dores: lista })
  },
  $apis.requireAuth(),
)
