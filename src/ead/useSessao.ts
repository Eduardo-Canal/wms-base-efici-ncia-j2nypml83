// src/ead/useSessao.ts — diz QUEM está logado e qual o papel dele.
//
// DEFEITO QUE ISTO CORRIGE (16/11 21:20, relatado pelo dono):
// o painel existe em /ead/admin, mas o link nunca aparecia no menu. O hook
// montava a sessão lendo o token, e o token do PocketBase carrega apenas
// { collectionId, exp, id, refreshable, type } — NÃO tem `papel`. Resultado:
// `papel` chegava vazio, virava 'aluno' por padrão, e nem o dono (admin no
// banco) via o atalho.
//
// A CORREÇÃO tem duas partes:
//   1. No login, o registro completo vem na resposta e é guardado em cache
//      (api.guardarPerfil) — a tela acerta de primeira.
//   2. Ao montar a página, o hook pergunta ao SERVIDOR quem é (auth-refresh),
//      porque o cache pode estar velho (ex.: o papel mudou depois do login).
//      Se o servidor recusar o token, a sessão é encerrada de verdade.
//
// A regra de quem PODE o quê continua no servidor: isto aqui só decide o que
// mostrar. Esconder o link do painel não é segurança — o hook admin-ead
// responde 403 para quem não é admin, com ou sem link na tela.
import { useEffect, useState } from 'react'
import { api, getToken, guardarPerfil, type Sessao } from './api'

export function useSessao() {
  const [sessao, setSessao] = useState<Sessao | null>(null)

  useEffect(() => {
    let vivo = true

    // 1) Estado imediato pelo que está guardado (evita piscar "Entre" para
    //    quem já está logado).
    const doCache = getToken() ? api.sessaoAtual() : null
    if (doCache) setSessao(doCache)

    // 2) Confirma com o servidor — é ele que sabe o papel de verdade.
    if (getToken()) {
      api
        .meuPerfil()
        .then((perfil) => {
          if (!vivo) return
          guardarPerfil(perfil)
          setSessao((atual) =>
            atual ? { token: atual.token, user: perfil } : { token: getToken(), user: perfil },
          )
        })
        .catch(() => {
          // Token inválido/vencido: encerra a sessão em vez de fingir que está
          // logado. Isso também tira o "Sair" de quem não está mais dentro.
          if (!vivo) return
          api.sair()
          setSessao(null)
        })
    }

    // 3) login/logout em outra aba, ou nesta (evento disparado por setToken).
    const aoMudar = () => setSessao(getToken() ? api.sessaoAtual() : null)
    window.addEventListener('storage', aoMudar)
    window.addEventListener('ead:sessao', aoMudar as EventListener)

    return () => {
      vivo = false
      window.removeEventListener('storage', aoMudar)
      window.removeEventListener('ead:sessao', aoMudar as EventListener)
    }
  }, [])

  return { sessao, logado: !!sessao }
}
