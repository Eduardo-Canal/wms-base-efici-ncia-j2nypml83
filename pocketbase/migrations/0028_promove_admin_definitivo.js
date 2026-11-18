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
// ── CORREÇÃO DE REVISÃO EXTERNA (item 18) ─────────────────────────────────
// A versão anterior LANÇAVA ERRO quando a conta não existia, para o build
// falhar e me avisar. O efeito colateral é grave: num banco NOVO (outro
// ambiente, restauração, projeto duplicado) a conta do dono ainda não existe,
// a migration lança, e o PocketBase não sobe. Uma migration de promoção não
// pode ser pré-requisito de boot.
// Agora registra no log e segue. A promoção do dono em banco novo é feita pelo
// painel (o primeiro usuário criado ali nasce admin) ou por uma migration nova,
// não por um throw.
//
// IDEMPOTENTE: se já for admin, só registra e segue.

migrate(
  (app) => {
    const EMAIL = 'eduardo.canal@zionlogtec.com.br'

    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL)
    } catch (_) {
      // Log, não throw (item 18): banco novo não pode ficar sem subir por causa
      // de uma promoção. Quando a conta existir, a promoção acontece no painel.
      console.log(
        '[ead] promocao: a conta ' +
          EMAIL +
          ' NAO EXISTE neste banco. Nada promovido (banco novo? use o painel).',
      )
      return
    }
    if (!user) {
      console.log('[ead] promocao: conta ' + EMAIL + ' nao encontrada. Nada promovido.')
      return
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
