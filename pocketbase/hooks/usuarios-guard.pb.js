// Guarda de campos protegidos em `users`: papel, verified, email.
// Sem este hook, createRule = "" (signup publico) + updateRule = dono deixariam
// qualquer visitante se cadastrar como admin, ou se auto-promover depois.
// ATENCAO: cada handler do JSVM roda em escopo isolado — nada fora do callback
// e visivel dentro dele, por isso tudo vive aqui dentro.
onRecordCreateRequest((e) => {
  let admin = false
  const auth = e.auth
  if (auth) {
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
  }
  if (!admin) {
    e.record.set('papel', 'aluno')
    e.record.set('verified', false)
  }
  e.next()
}, 'users')

onRecordUpdateRequest((e) => {
  const protegidos = ['papel', 'verified', 'email']
  let admin = false
  const auth = e.auth
  if (auth) {
    try {
      if (auth.collection().name === '_superusers') admin = true
      else admin = String(auth.get('papel')) === 'admin'
    } catch (_) {}
  }
  if (!admin) {
    const original = $app.findRecordById('users', e.record.id)
    for (let i = 0; i < protegidos.length; i++) {
      const campo = protegidos[i]
      if (String(e.record.get(campo)) !== String(original.get(campo))) {
        e.record.set(campo, original.get(campo))
      }
    }
  }
  e.next()
}, 'users')
