// src/ead/telas/Player.tsx → rota /ead/aula/:slug
// Vídeo por URL assinada (10 min), PDF e pergunta de fixação, botão de concluir.
//
// 1. A URL assinada EXPIRA em 10 min: se o aluno pausar e voltar, o iframe dá
//    403 sem avisar. Por isso há "Recarregar vídeo" e renovação automática 60 s
//    antes de expirar, enquanto a aba está visível.
// 2. Aula sem vídeo pronto recebe 409 → estado previsto ("em produção"), sem
//    botão de repetir.
// 3. 403 sem_matricula → caminho de compra, nunca tela em branco.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, ErroApi, getToken, type Playback } from '../api'
import { Button } from '@/components/ui/button'

type Estado =
  | { t: 'carregando' }
  | { t: 'ok'; dados: Playback }
  | { t: 'sem_acesso' }
  | { t: 'sem_login' }
  | { t: 'em_producao' }
  | { t: 'erro'; msg: string }

export default function Player() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const amostra = params.get('amostra') === '1'
  const [estado, setEstado] = useState<Estado>({ t: 'carregando' })
  const [concluida, setConcluida] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const expiraRef = useRef<number>(0)

  const carregar = useCallback(async () => {
    setEstado({ t: 'carregando' })
    try {
      const dados = await api.playback(slug, amostra)
      expiraRef.current = dados.expira_em
      setEstado({ t: 'ok', dados })
    } catch (err) {
      if (err instanceof ErroApi) {
        if (err.status === 401) return setEstado({ t: 'sem_login' })
        if (err.status === 403 && err.codigo === 'precisa_login')
          return setEstado({ t: 'sem_login' })
        if (err.status === 403) return setEstado({ t: 'sem_acesso' })
        if (err.status === 409) return setEstado({ t: 'em_producao' })
        if (err.status === 404) return setEstado({ t: 'erro', msg: 'Aula não encontrada.' })
      }
      setEstado({ t: 'erro', msg: 'Não foi possível abrir o vídeo, tente de novo.' })
    }
  }, [slug, amostra])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Renova a assinatura 60 s antes de expirar, só com a aba visível.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const faltam = expiraRef.current - Math.floor(Date.now() / 1000)
      if (faltam > 0 && faltam < 60) carregar()
    }, 15000)
    return () => clearInterval(timer)
  }, [carregar])

  async function marcarConcluida() {
    if (estado.t !== 'ok') return
    if (!getToken()) return setEstado({ t: 'sem_login' })
    setSalvando(true)
    try {
      const me = api.sessaoAtual()
      const aulaId = estado.dados.aula.id
      if (!me || !aulaId) return
      await fetch(
        `${(import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''}/api/collections/progresso_aulas/records`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: getToken() },
          body: JSON.stringify({ user: me.user.id, aula: aulaId, concluida: true }),
        },
      )
      setConcluida(true)
    } catch {
      // já existe linha (unique user+aula) ou erro de rede: não trava o aluno
    } finally {
      setSalvando(false)
    }
  }

  if (estado.t === 'carregando')
    return <p className="px-4 py-16 text-center text-muted-foreground">Abrindo aula…</p>

  if (estado.t === 'sem_login')
    return (
      <Aviso titulo="Entre para assistir">
        <Button asChild>
          <Link to={`/ead/entrar?voltar=/ead/aula/${slug}`}>Entrar ou criar conta</Link>
        </Button>
      </Aviso>
    )

  if (estado.t === 'sem_acesso')
    return (
      <Aviso titulo="Esta aula faz parte de um curso">
        <p className="text-muted-foreground">Você ainda não tem acesso a este curso.</p>
        <Button asChild className="mt-4">
          <Link to="/ead">Ver o curso</Link>
        </Button>
      </Aviso>
    )

  if (estado.t === 'em_producao')
    return (
      <Aviso titulo="Aula em produção">
        <p className="text-muted-foreground">Esta aula ainda não tem vídeo publicado.</p>
      </Aviso>
    )

  if (estado.t === 'erro')
    return (
      <Aviso titulo="Não foi possível abrir o vídeo">
        <p className="text-muted-foreground">{estado.msg}</p>
        <Button variant="outline" className="mt-4" onClick={carregar}>
          Tentar de novo
        </Button>
      </Aviso>
    )

  const d = estado.dados

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="overflow-hidden rounded-lg bg-black">
        <div className="relative aspect-video">
          <iframe
            // URL assinada gerada no servidor. O video_id nunca chega ao cliente.
            src={d.player}
            title={d.aula.titulo}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{d.aula.numero}</p>
          <h1 className="text-xl font-semibold">{d.aula.titulo}</h1>
        </div>
        <Button variant="outline" onClick={marcarConcluida} disabled={salvando || concluida}>
          {concluida ? '✓ Concluída' : salvando ? 'Salvando…' : 'Marcar como concluída'}
        </Button>
      </div>

      {/* Material só chega quando há matrícula — o endpoint é quem checa. */}
      {d.material && (
        <a
          href={d.material}
          download
          className="mt-6 inline-block rounded border px-4 py-2 text-sm"
        >
          Baixar o PDF da aula
        </a>
      )}

      {d.pergunta_fixacao && (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h2 className="text-sm font-medium">Para fixar</h2>
          <p className="mt-1 whitespace-pre-line text-foreground/80">{d.pergunta_fixacao}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sem correção automática — anote a resposta antes da próxima aula.
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-between text-sm">
        <Link to="/ead/minha-area" className="text-muted-foreground underline">
          Minha área
        </Link>
        <button onClick={carregar} className="text-muted-foreground underline">
          Recarregar vídeo
        </button>
      </div>
    </div>
  )
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <div className="mt-3">{children}</div>
    </div>
  )
}
