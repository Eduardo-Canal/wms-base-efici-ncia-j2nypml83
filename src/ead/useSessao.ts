// src/ead/useSessao.ts — diz se há alguém logado, para as telas ajustarem o texto.
// Não valida o token contra o servidor: o token é de quem barra o acesso, e ele
// é checado em cada endpoint. Aqui só evita mostrar "Comprar" a quem já entrou.
import { useEffect, useState } from 'react'
import { api, getToken, type Sessao } from './api'

export function useSessao() {
  const [sessao, setSessao] = useState<Sessao | null>(null)

  useEffect(() => {
    const atual = getToken() ? api.sessaoAtual() : null
    setSessao(atual)
    // login/logout em outra aba reflete aqui
    const aoMudar = () => setSessao(getToken() ? api.sessaoAtual() : null)
    window.addEventListener('storage', aoMudar)
    window.addEventListener('ead:sessao', aoMudar as EventListener)
    return () => {
      window.removeEventListener('storage', aoMudar)
      window.removeEventListener('ead:sessao', aoMudar as EventListener)
    }
  }, [])

  return { sessao, logado: !!sessao }
}
