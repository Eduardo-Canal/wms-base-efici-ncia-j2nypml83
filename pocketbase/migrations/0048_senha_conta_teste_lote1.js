// 0048_senha_conta_teste_lote1.js

// ── REMOVIDA DO HISTÓRICO ATIVO (23/11) ──────────────────────────────────
//
// Esta migration criava uma conta de teste ADMIN com senha CONHECIDA em texto
// claro, no repositório. O repo é público. A conta já foi apagada no banco
// (0043), mas a senha continuava escrita aqui — qualquer um que voltasse o
// clone e achasse a conta viva teria acesso de administrador.
//
// REGRA QUE FICA: não se cria conta de teste por migration. A senha vive em
// lugar que não versiona nada, e o teste de admin usa o superusuário do Skip.
//
// O ARQUIVO FICA VAZIO EM VEZ DE APAGADO porque migration aplicada não roda de
// novo; apagar o arquivo não desfaz nada e atrapalha a comparação com o banco.
// Se você precisa do código original, ele está no histórico do Git: e39e3a0 ou
// anterior. Se este arquivo aparecer em outro clone, ele não faz mais nada.
