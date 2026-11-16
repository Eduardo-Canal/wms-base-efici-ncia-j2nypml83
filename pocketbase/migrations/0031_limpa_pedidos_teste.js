// 0031_limpa_pedidos_teste.js
//
// Remove os pedidos de TESTE que eu criei ao diagnosticar o checkout.
//
// POR QUE: enquanto eu verificava por que todo pedido falhava, criei 3 pedidos
// com e-mails inventados (teste@exemplo.com etc.). Eles ficam na lista do
// painel e poluem o número de vendas. Não são dados de cliente — são lixo meu.
//
// CRITÉRIO ESTRITO, para não apagar venda de verdade por engano:
//   - status = 'pendente'  (nunca chegou a ser pago)
//   - pref_id vazio        (o gateway nunca gerou preferência)
//   - e-mail terminando em '@exemplo.com'
// Um pedido real de cliente não tem e-mail @exemplo.com, então não há risco.
//
// NÃO APAGA MATRÍCULA NEM USUÁRIO: só pedidos. Contas de teste ficam para uma
// migration separada, com autorização explícita do dono.

migrate(
  (app) => {
    let apagados = 0
    try {
      const lixo = app.findRecordsByFilter(
        'pedidos',
        "status = 'pendente' && pref_id = '' && email_comprador ~ 'exemplo.com'",
        '',
        200,
        0,
      )
      for (let i = 0; i < lixo.length; i++) {
        app.delete(lixo[i])
        apagados++
      }
    } catch (err) {
      console.log('[ead] limpeza de pedidos: ' + err.message)
    }
    console.log('[ead] pedidos de teste removidos: ' + apagados)
  },
  (app) => {
    /* limpeza não tem volta: não havia dado útil a restaurar */
  },
)
