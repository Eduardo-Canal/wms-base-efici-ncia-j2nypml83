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
  const expiraRef = useRef<number>(0)
  // Progresso medido por tempo assistido (decisão do dono, 16/11 17:03 |
  // opção (a)). Não existe mais botão "marcar como concluída": quem mede é o
  // player e quem decide é o servidor.
  const [assistido, setAssistido] = useState({ seg: 0, alvo: 0, concluida: false })
  const pontosRef = useRef<{ pos: number; dur: number }[]>([])

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

  // O PDF mora no Google Drive e o LINK só é entregue pelo endpoint /material,
  // que confere matrícula. Por isso não guardamos o link no estado da página:
  // a cada clique perguntamos ao servidor.
  const [baixando, setBaixando] = useState(false)
  async function abrirMaterial() {
    setBaixando(true)
    try {
      const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
      const r = await fetch(`${base}/backend/v1/aulas/${encodeURIComponent(slug)}/material`, {
        headers: { Authorization: getToken() },
      })
      const d = await r.json()
      if (!r.ok || !d.url) {
        setErroMaterial(d.mensagem ?? 'Material indisponível.')
        return
      }
      window.open(d.url, '_blank', 'noopener,noreferrer')
    } catch {
      setErroMaterial('Não foi possível abrir o material agora.')
    } finally {
      setBaixando(false)
    }
  }
  const [erroMaterial, setErroMaterial] = useState('')

  // ---- rastreamento do tempo assistido ----
  // POR QUE ASSIM (e não "marcar como concluída"):
  // o botão deixava o aluno marcar as 20 aulas em 2 minutos e o certificado
  // atestava um clique. Agora o player avisa o servidor a cada 20 s de
  // reprodução e o servidor soma TEMPO REAL (ver progresso-aula.pb.js).
  // Só a posição do playhead não serve: arrastar a barra para o fim poria a
  // posição no fim sem ninguém ter assistido.
  useEffect(() => {
    if (estado.t !== 'ok' || !getToken()) return
    const aulaSlug = estado.dados.aula.slug
    const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''

    const enviar = async (segundos: number, duracao: number) => {
      try {
        const r = await fetch(`${base}/backend/v1/aula/${encodeURIComponent(aulaSlug)}/progresso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: getToken() },
          body: JSON.stringify({ segundos, duracao }),
        })
        if (!r.ok) return
        const d = await r.json()
        setAssistido({
          seg: d.assistidos_seg ?? 0,
          alvo: d.alvo_seg ?? 0,
          concluida: d.concluida === true,
        })
      } catch {
        /* rede caiu: o próximo report tenta de novo */
      }
    }

    // Reporta no máximo a cada 20 s (e no mínimo depois de 10 s de vídeo),
    // para não inundar o servidor nem ficar 1 min sem gravar.
    let ultimoEnvio = 0
    const intervalo = setInterval(() => {
      const pts = pontosRef.current
      if (!pts.length) return
      const agora = Date.now()
      if (agora - ultimoEnvio < 20000) return
      ultimoEnvio = agora
      const ultima = pts[pts.length - 1]
      void enviar(ultima.pos, ultima.dur)
    }, 5000)

    // Recebe os eventos do player do Bunny (player.js por postMessage).
    // O iframe é de outra origem: a única forma é a API postMessage documentada.
    const receber = (ev: MessageEvent) => {
      if (ev.origin.indexOf('mediadelivery.net') === -1) return
      let msg: any = ev.data
      try {
        if (typeof msg === 'string') msg = JSON.parse(msg)
      } catch {
        return
      }
      if (!msg || msg.event !== 'timeupdate') return
      const seg = Number(msg.value?.seconds ?? msg.seconds ?? 0)
      const dur = Number(msg.value?.duration ?? msg.duration ?? 0)
      if (!isFinite(seg) || !isFinite(dur) || dur <= 0) return
      const pts = pontosRef.current
      pts.push({ pos: Math.floor(seg), dur: Math.floor(dur) })
      if (pts.length > 500) pts.shift()
    }

    window.addEventListener('message', receber)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('message', receber)
    }
  }, [estado])

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
        {/* A conclusão é automática. O que a tela deve ao aluno é o número
            honesto de quanto falta — nunca um botão que ele aperta sem ter
            assistido. */}
        {assistido.concluida ? (
          <span className="rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800">
            ✓ Aula concluída
          </span>
        ) : assistido.alvo > 0 ? (
          <span className="text-sm text-muted-foreground">
            {Math.round((assistido.seg / assistido.alvo) * 100)}% assistido — a aula conclui sozinha
            ao assistir
          </span>
        ) : null}
      </div>

      {/* Material só chega quando há matrícula — o endpoint é quem checa. */}
      {(d as any).tem_material && (
        <div className="mt-6">
          <Button variant="outline" onClick={abrirMaterial} disabled={baixando}>
            {baixando ? 'Abrindo…' : 'Abrir o PDF da aula'}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">Abre no Google Drive, em nova aba.</p>
          {erroMaterial && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {erroMaterial}
            </p>
          )}
        </div>
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
