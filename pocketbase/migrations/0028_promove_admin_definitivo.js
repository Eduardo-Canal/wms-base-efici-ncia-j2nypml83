// 0028_promove_admin_definitivo.js
//
// Segunda tentativa de promoção — agora com VERIFICAÇÃO que falha alto.
//
// POR QUE ESTA MIGRATION EXISTE:
// a 0026 e a 0027 rodaram por volta de 23:31, e o dono tentou criar a conta
// logo depois. Se a conta ainda não existia quando elas rodaram, elas não
// fizeram nada (por desenho: não criam conta). Resultado: a conta ficou como
// `aluno` e o menu nunca mostrou o link "Painel".
//
// A DIFERENÇA DESTA: se a conta não existir, ela LANÇA ERRO e o build falha.
// É de propósito — uma migration silenciosa que "não encontra" é justamente o
// que me deixou sem saber se a promoção tinha pegado. Falhar aqui me diz na
// hora, e nada vai para produção sem eu ver.
//
// IDEMPOTENTE: se já for admin, só registra e segue.

migrate(
  (app) => {
    const EMAIL = 'eduardo.canal@zionlogtec.com.br'

    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      throw new Error(
        '[ead] promocao: a conta ' +
          EMAIL +
          ' NAO EXISTE. Peca ao dono para criar a conta em /ead/entrar e rode esta migration de novo.',
      )
    }

    const antes = String(user.get('papel') || '(vazio)')
    user.set('papel', 'admin')
    user.set('verified', true)
    app.save(user)
    console.log('[ead] promocao: ' + EMAIL + ' papel "' + antes + '" -> "admin" (verificado)')
  },
  (app) => {
    /* reverter rebaixaria o dono; a promoção é intencional e não tem volta
       automática. Para desfazer, uma migration nova e explícita. */
  },
)
