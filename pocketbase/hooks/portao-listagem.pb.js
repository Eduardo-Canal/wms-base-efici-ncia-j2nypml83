// portao-listagem.pb.js — fecha o CATÁLOGO para o visitante quando a área está fechada.
//
// DEFEITO QUE ESTE ARQUIVO CORRIGE (encontrado no navegador, 15/11 20h30):
// os hooks de playback/material/admin barraram vídeo, PDF e painel, mas o
// visitante continuava VENDO o catálogo em /ead — porque `cursos` e `produtos`
// têm listRule pública própria. Portão que só cobre endpoint não é portão: a
// vitrine fica exposta antes da hora de liberar.
//
// POR QUE AQUI E NÃO NA listRule:
// a regra de linha só enxerga a própria linha — não dá para dizer "só se
// ead_config.liberado = true" numa regra de `cursos`, porque regra não faz join
// em outra coleção nesse formato. E o guia do Skip é explícito: esconder linha
// pertence à listRule, não ao hook.
//
// A SOLUÇÃO: recusar a REQUISIÇÃO de listagem enquanto a área estiver fechada.
// 403 é honesto — a vitrine não está em rascunho "invisível", ela não existe
// para quem não é da equipe. A tela mostra "área em preparação".
//
// LIMITE DECLARADO: isto protege a LISTAGEM. Uma coleção nova que alguém criar
// com listRule pública e exibir no /ead precisa do mesmo tratamento — não há
// herança de regra entre coleções.

const areaAberta = () => {
  try {
    const cfg = $app.findFirstRecordByFilter('ead_config', "chave = 'principal'")
    return cfg.getBool('liberado') === true
  } catch (_) {
    return false // na dúvida, fechado
  }
}

const souEquipe = (auth) => {
  if (!auth) return false
  try {
    if (auth.collection().name === '_superusers') return true
    const papel = String(auth.get('papel'))
    return papel === 'admin' || papel === 'suporte'
  } catch (_) {
    return false
  }
}

// Recusa a listagem para quem não é da equipe, quando a área está fechada.
// e.next() em TODOS os caminhos de liberação — sem isso a requisição trava.
const fechar = (e) => {
  if (areaAberta()) return e.next()
  let auth = null
  try {
    auth = e.requestInfo().auth
  } catch (_) {}
  if (souEquipe(auth)) return e.next()
  throw new ForbiddenError('A área de cursos ainda não está aberta.')
}

onRecordsListRequest(fechar, 'cursos')
onRecordsListRequest(fechar, 'produtos')
onRecordsListRequest(fechar, 'modulos')
