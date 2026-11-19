// admin-limite-status.pb.js — GET /backend/v1/admin/limite
//
// Diagnóstico do limitador de rotas próprias (revisão externa, item 11).
// Mostra as linhas de `limite_requisicoes` (chave, contador, início da janela).
// A coleção é fechada à API; este endpoint é a única leitura, e só para admin.
//
// POR QUE EXISTE: ao testar a rajada, o limite não devolvia 429 e o hook
// engolia o erro num catch — sem visibilidade eu não sabia se era permissão,
// tabela ausente ou lógica. Este endpoint responde isso.

routerAdd(
  'GET',
  '/backend/v1/admin/limite',
  (e) => {
    const auth = e.requestInfo().auth
    if (!auth) return e.json(401, { codigo: 'precisa_login', mensagem: 'Entre para continuar.' })
    let admin = false
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
    if (!admin) return e.json(403, { codigo: 'sem_permissao', mensagem: 'Só o administrador.' })

    const linhas = []
    let erro = ''
    try {
      const regs = $app.findRecordsByFilter(
        'limite_requisicoes',
        "id != ''",
        '-janela_inicio',
        50,
        0,
      )
      for (let i = 0; i < regs.length; i++) {
        linhas.push({
          chave: regs[i].getString('chave'),
          contador: regs[i].getInt('contador'),
          janela_inicio: regs[i].getString('janela_inicio'),
        })
      }
    } catch (err) {
      erro = err.message
    }

    // Teste de escrita: prova se o endpoint consegue salvar (permissão).
    let escritaOk = false
    let erroEscrita = ''
    try {
      const col = $app.findCollectionByNameOrId('limite_requisicoes')
      const t = new Record(col)
      t.set('chave', 'teste_diagnostico|' + Date.now())
      t.set('contador', 1)
      t.set('janela_inicio', new Date().toISOString())
      $app.save(t)
      $app.delete(t)
      escritaOk = true
    } catch (errW) {
      erroEscrita = errW.message
    }

    return e.json(200, {
      total_linhas: linhas.length,
      linhas: linhas,
      leitura_ok: !erro,
      erro_leitura: erro,
      escrita_ok: escritaOk,
      erro_escrita: erroEscrita,
    })
  },
  $apis.requireAuth(),
)
