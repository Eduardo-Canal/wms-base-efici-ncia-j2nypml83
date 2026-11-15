// 0018_aulas_listagem_publica — defeito real encontrado em teste no navegador:
// a página do curso mostrava "0 aulas" para o visitante.
//
// Causa: listRule/viewRule de `aulas` estava como
//   @request.auth.papel = "admin" || @request.auth.papel = "suporte"
// ou seja, NINGUÉM além de admin/suporte conseguia listar aulas — nem o aluno
// logado, nem o visitante. O currículo e os cadeados da página do curso dependem
// dessa listagem.
//
// O certo: aula publicada é pública (título e número não são segredo; o que é
// pago é o VÍDEO, e esse passa pelo endpoint de playback com verificação).
// Rascunho continua visível apenas para admin/suporte.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('aulas')
    var regra =
      'publicado = true || @request.auth.papel = "admin" || @request.auth.papel = "suporte"'
    col.listRule = regra
    col.viewRule = regra
    // material (PDF) não pode sair por aqui: fica fora do alcance de quem não tem
    // matrícula porque o arquivo só é servido pelo endpoint que confere o acesso.
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('aulas')
      col.listRule = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'
      col.viewRule = '@request.auth.papel = "admin" || @request.auth.papel = "suporte"'
      app.save(col)
    } catch (e) {}
  },
)
