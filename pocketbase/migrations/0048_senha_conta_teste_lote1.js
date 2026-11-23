// 0048_senha_conta_teste_lote1.js
//
// ── VAZIA DE PROPÓSITO (23/11) ────────────────────────────────────────────
//
// Esta migration definia uma senha CONHECIDA em texto claro para a conta de
// teste admin criada pela 0044. O repositório é público.
//
// A conta foi apagada (0043) e o login confirma isso (400 "Failed to
// authenticate"), mas a senha continuava legível no arquivo — e uma senha de
// admin escrita no código é o tipo de coisa que sobrevive a uma restauração de
// backup e volta a valer.
//
// REGRA QUE FICA: senha não entra em arquivo versionado, nem de teste. O teste
// de admin usa o superusuário do Skip.
//
// O código original está no histórico do Git, no commit e39e3a0 ou anterior.
