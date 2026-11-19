// otp-verificado.pb.js — depois de entrar por código, a conta fica verificada.
//
// LOTE 2, item 1: "Depois desse login o usuário precisa ficar com verified=true;
// se o PocketBase não marcar sozinho, marcar num hook de autenticação."
//
// POR QUE ISSO É NECESSÁRIO: o OTP prova posse do e-mail — quem digitou o código
// recebeu o e-mail. Isso é exatamente o que `verified` significa. Mas o
// PocketBase NÃO marca `verified` no login por OTP (ele só marca no fluxo de
// confirmação por link). Sem este hook, o resgate do presente recusaria com
// "verificar e-mail" uma pessoa que acabou de provar que tem o e-mail.
//
// POR QUE AQUI E NÃO NA ROTA DE ENTRADA: o login acontece no endpoint NATIVO
// (auth-with-otp), que é onde a sessão nasce. Marcar na rota
// /ead/entrar/codigo seria torcer para o front chamar na ordem certa.

onRecordAuthWithOTPRequest((e) => {
  // Deixa o PocketBase concluir a autenticação primeiro: o registro só é
  // definitivo depois de e.next().
  e.next()

  // Se autenticou, o e-mail está provado.
  try {
    const auth = e.requestInfo().auth
    if (auth && !auth.getBool('verified')) {
      auth.set('verified', true)
      $app.save(auth)
      console.log('[ead][otp] conta verificada por login com código: ' + auth.getString('email'))
    }
  } catch (err) {
    console.log('[ead][otp] falha ao marcar verified: ' + err.message)
  }
}, 'users')
