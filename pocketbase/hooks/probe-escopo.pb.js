// PROBE temporario — verifica se declaracao de topo e visivel dentro do callback
// no runtime do Skip (goja). Sera apagado.
const VALOR_TOPO = 'visivel'
function funcaoTopo() {
  return 'funcao-visivel'
}

routerAdd('GET', '/backend/v1/probe-escopo', (e) => {
  const out = { constante: '', funcao: '', erroConst: '', erroFunc: '' }
  try {
    out.constante = String(VALOR_TOPO)
  } catch (err) {
    out.erroConst = String(err && err.message ? err.message : err)
  }
  try {
    out.funcao = String(funcaoTopo())
  } catch (err) {
    out.erroFunc = String(err && err.message ? err.message : err)
  }
  return e.json(200, out)
})
