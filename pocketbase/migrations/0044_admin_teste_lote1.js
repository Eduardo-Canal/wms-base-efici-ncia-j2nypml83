// 0044_admin_teste_lote1.js
//
// ── VAZIA DE PROPÓSITO (23/11) ────────────────────────────────────────────
//
// Esta migration criava uma conta de teste ADMIN com senha ALEATÓRIA, e a 0048
// logo abaixo definia uma senha CONHECIDA em texto claro. O repositório é
// público: a senha ficava versionada para sempre, ao lado do e-mail da conta.
//
// A conta já foi apagada do banco pela 0043 (confirmei: login responde 400
// "Failed to authenticate"). Mesmo assim o par e-mail + senha de ADMIN seguia
// escrito no código — se alguém recriasse aquele e-mail, herdava o acesso.
//
// REGRA QUE FICA: não se cria conta de teste por migration. Teste de admin usa
// o superusuário do Skip; conta de aluno vem pela rota normal de entrada.
//
// O ARQUIVO FICA (vazio) EM VEZ DE SER APAGADO: migration já aplicada não roda
// de novo, então apagar não desfaz nada e atrapalha a comparação com o banco.
// O código original está no histórico do Git, no commit e39e3a0 ou anterior.
