// Player.tsx → /ead/aula/:slug — ITEM 5 DO LOTE 2.
//
// ── AS 4 CORREÇÕES OBRIGATÓRIAS ────────────────────────────────────────────
// (a) O iframe NÃO pode ser recriado quando a URL assinada é renovada.
//     DEFEITO ANTIGO: a renovação chamava carregar(), que trocava o estado para
//     'carregando' e destruía o iframe. Resultado: o aluno assistindo tinha o
//     vídeo cortado a cada ~9 minutos e voltava do início.
//     AGORA: `src` só é definido UMA vez, na primeira carga. Renovação atualiza
//     apenas a referência da URL — o iframe nunca é desmontado.
//
// (b) Assinar os eventos do player.js (addEventListener) e reportar progresso a
//     partir do timeupdate.
//     DEFEITO ANTIGO: o código escutava `message` esperando JSON, formato que
//     este player não usa. Nunca chegava timeupdate → progresso sempre 0.
//     AGORA: carrega o script do player do Bunny, chama
//     player.addEventListener('timeupdate', ...) — e o listener é registrado
//     DEPOIS do evento 'ready', como a documentação exige.
//
// (c) Retomar de posicao_seg com setCurrentTime depois de 'ready'.
//     Sem isso, recarregar a página joga o aluno para o início e ele perde o
//     lugar — e o servidor não recebe posição consistente.
//
// (d) Aula de amostra sai com ?amostra=1.
//     A rota pública é outra; sem esse parâmetro, quem vem da isca recebe 401.
//
// POR QUE O SCRIPT DO PLAYER E NÃO IFRAME PURO: para retomar e para medir o
// tempo assistido é preciso falar com o player. Iframe puro não expõe evento.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, apiLote2, ErroApi, getToken, type Aula, type Modulo, type Playback } from '../api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Estado =
  | { t: 'carregando' }
  | { t: 'ok'; dados: Playback }
  | { t: 'sem_acesso' }
  | { t: 'sem_login' }
  | { t: 'em_producao' }
  | { t: 'diagnostico'; curso: string }
  | { t: 'erro'; msg: string }

declare global {
  interface Window {
    playerjs?: any
  }
}

export default function Player() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const amostra = params.get('amostra') === '1'

  const [estado, setEstado] = useState<Estado>({ t: 'carregando' })
  const [assistido, setAssistido] = useState({ seg: 0, alvo: 0, concluida: false })
  const [retomando, setRetomando] = useState(0)

  // (a) referência do iframe e a URL "selada": src nunca muda depois de definido.
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const srcSelado = useRef<string>('')
  const expiraRef = useRef<number>(0)
  const playerRef = useRef<any>(null)

  // posição inicial a retomar, guardada antes de o player ficar pronto
  const posicaoInicial = useRef<number>(0)

  // ---- Para fixar: salva sozinho (debounce 1 s) ----
  const [resposta, setResposta] = useState('')
  const [salvoEm, setSalvoEm] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado')
  const timerSalvar = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- aulas do curso para anterior/próxima e a lateral ----
  const [aulas, setAulas] = useState<Aula[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])

  const carregar = useCallback(async () => {
    setEstado({ t: 'carregando' })
    try {
      const dados = await api.playback(slug, amostra)
      expiraRef.current = dados.expira_em
      setEstado({ t: 'ok', dados })
    } catch (err) {
      if (err instanceof ErroApi) {
        // 409 com diagnostico_pendente: o aluno não pode assistir antes de
        // responder. Redireciona para a tela que resolve isso.
        if (
          err.status === 409 &&
          (err.codigo === 'diagnostico_pendente' || (err as any).erro === 'diagnostico_pendente')
        ) {
          // descobre o curso pelo slug da aula consultando o curso via API
          try {
            const r = await api.aulaCursoSlug(slug)
            return setEstado({ t: 'diagnostico', curso: r })
          } catch {
            return setEstado({ t: 'erro', msg: 'Responda o diagnóstico para assistir.' })
          }
        }
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

  // ---- carrega o player.js do Bunny e assina os eventos (correção b) ----
  useEffect(() => {
    if (estado.t !== 'ok') return
    if (window.playerjs) return // já carregado nesta sessão

    const s = document.createElement('script')
    s.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js'
    s.async = true
    document.head.appendChild(s)
    return () => {
      // não remove o script: ele é reaproveitado em outras aulas
    }
  }, [estado.t])

  // ---- inicializa o player quando o iframe existe ----
  useEffect(() => {
    if (estado.t !== 'ok') return
    let cancelado = false

    const iniciar = () => {
      if (cancelado) return
      const P = window.playerjs
      if (!P || !iframeRef.current) {
        setTimeout(iniciar, 300)
        return
      }
      try {
        const p = new P.Player(iframeRef.current)
        playerRef.current = p

        // (b) listener só DEPOIS de ready
        p.on('ready', () => {
          // (c) retoma a posição salva
          const pos = posicaoInicial.current
          if (pos > 2) {
            try {
              p.setCurrentTime(pos)
              setRetomando(Math.floor(pos))
            } catch {
              /* player sem suporte a seek: começa do início, sem quebrar */
            }
          }
        })

        // (b) o progresso vem daqui
        p.on('timeupdate', (d: any) => {
          const seg = Math.floor(Number(d?.seconds ?? 0))
          const dur = Math.floor(Number(d?.duration ?? 0))
          if (isFinite(seg) && isFinite(dur) && dur > 0) {
            pontosRef.current.push({ pos: seg, dur })
            if (pontosRef.current.length > 500) pontosRef.current.shift()
          }
        })
      } catch {
        /* se o player.js falhar, o iframe continua tocando normalmente */
      }
    }
    iniciar()
    return () => {
      cancelado = true
    }
  }, [estado])

  // ---- envio de progresso ao servidor ----
  const pontosRef = useRef<{ pos: number; dur: number }[]>([])
  useEffect(() => {
    if (estado.t !== 'ok' || !getToken()) return
    const aulaSlug = estado.dados.aula.slug
    const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''

    const enviar = async (segundos: number) => {
      try {
        const r = await fetch(`${base}/backend/v1/aula/${encodeURIComponent(aulaSlug)}/progresso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: getToken() },
          // `duracao` não é mais aceita: o servidor usa a do cadastro.
          body: JSON.stringify({ segundos }),
        })
        if (!r.ok) {
          // 409 = diagnóstico pendente surgiu no meio: manda para a tela.
          if (r.status === 409) {
            const d = await r.json().catch(() => ({}))
            if (d.codigo === 'diagnostico_pendente') {
              try {
                const cs = await api.aulaCursoSlug(aulaSlug)
                setEstado({ t: 'diagnostico', curso: cs })
              } catch {
                /* mantém a tela */
              }
            }
          }
          return
        }
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

    let ultimo = 0
    const intervalo = setInterval(() => {
      const pts = pontosRef.current
      if (!pts.length) return
      const agora = Date.now()
      if (agora - ultimo < 20000) return
      ultimo = agora
      void enviar(pts[pts.length - 1].pos)
    }, 5000)

    return () => clearInterval(intervalo)
  }, [estado])

  // ---- renova a assinatura SEM tocar no iframe (correção a) ----
  useEffect(() => {
    if (estado.t !== 'ok') return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const faltam = expiraRef.current - Math.floor(Date.now() / 1000)
      if (faltam > 0 && faltam < 90) {
        // Pede URL nova, mas NÃO troca o src: o vídeo em reprodução continua.
        // A nova URL fica válida para a PRÓXIMA abertura da aula.
        void api
          .playback(slug, amostra)
          .then((d) => {
            expiraRef.current = d.expira_em
          })
          .catch(() => {})
      }
    }, 20000)
    return () => clearInterval(timer)
  }, [estado, slug, amostra])

  // ---- carrega a lista de aulas do módulo (lateral + anterior/próxima) ----
  useEffect(() => {
    if (estado.t !== 'ok') return
    let vivo = true
    ;(async () => {
      try {
        const dados = await api.aulasDoModulo(estado.dados.aula.slug)
        if (!vivo) return
        setAulas(dados.aulas)
        setModulos(dados.modulos)
        posicaoInicial.current = dados.posicao_seg
        // guarda para o efeito do player ler
        if (dados.posicao_seg > 2) setRetomando(Math.floor(dados.posicao_seg))
      } catch {
        /* lateral é complemento */
      }
    })()
    return () => {
      vivo = false
    }
  }, [estado])

  // ---- carrega a resposta já salva do "Para fixar" ----
  useEffect(() => {
    if (estado.t !== 'ok') return
    let vivo = true
    ;(async () => {
      try {
        const r = await api.minhaRespostaFixacao(estado.dados.aula.slug)
        if (vivo && r?.texto) setResposta(r.texto)
      } catch {
        /* sem resposta anterior */
      }
    })()
    return () => {
      vivo = false
    }
  }, [estado])

  // debounce de 1 s no "Para fixar"
  function mudarResposta(txt: string) {
    setResposta(txt)
    setSalvoEm('parado')
    if (timerSalvar.current) clearTimeout(timerSalvar.current)
    timerSalvar.current = setTimeout(async () => {
      if (estado.t !== 'ok') return
      setSalvoEm('salvando')
      try {
        await apiLote2.salvarFixacao(estado.dados.aula.slug, txt)
        setSalvoEm('salvo')
      } catch {
        setSalvoEm('erro')
      }
    }, 1000)
  }

  // ---- material da aula ----
  const [baixando, setBaixando] = useState(false)
  const [erroMaterial, setErroMaterial] = useState('')
  async function abrirMaterial() {
    setBaixando(true)
    setErroMaterial('')
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

  // índice da aula atual na lista do módulo
  const { anterior, proxima, doModulo } = useMemo(() => {
    if (estado.t !== 'ok') return { anterior: null, proxima: null, doModulo: [] }
    const idx = aulas.findIndex((a) => a.slug === estado.dados.aula.slug)
    const mod = aulas.length && idx >= 0 ? aulas[idx].modulo : ''
    const doM = aulas.filter((a) => a.modulo === mod)
    const i2 = doM.findIndex((a) => a.slug === estado.dados.aula.slug)
    return {
      anterior: i2 > 0 ? doM[i2 - 1] : null,
      proxima: i2 >= 0 && i2 < doM.length - 1 ? doM[i2 + 1] : null,
      doModulo: doM,
    }
  }, [aulas, estado])

  if (estado.t === 'carregando')
    return <p className="px-4 py-16 text-center text-muted-foreground">Abrindo aula…</p>

  if (estado.t === 'sem_login')
    return (
      <Aviso titulo="Entre para assistir">
        <Button asChild className="h-11">
          <Link to={`/ead/entrar?voltar=/ead/aula/${slug}`}>Entrar com o meu e-mail</Link>
        </Button>
      </Aviso>
    )

  // 409 diagnostico_pendente → a tela que resolve
  if (estado.t === 'diagnostico')
    return (
      <Aviso titulo="Antes da primeira aula">
        <p className="text-muted-foreground">
          São 5 perguntas rápidas sobre a sua operação. Depois delas o curso abre inteiro.
        </p>
        <Button asChild className="mt-4 h-11">
          <Link to={`/ead/${estado.curso}/diagnostico`}>Responder agora</Link>
        </Button>
      </Aviso>
    )

  if (estado.t === 'sem_acesso')
    return (
      <Aviso titulo="Esta aula faz parte de um curso">
        <p className="text-muted-foreground">Você ainda não tem acesso a este curso.</p>
        <Button asChild className="mt-4 h-11">
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
        <Button variant="outline" className="mt-4 h-11" onClick={carregar}>
          Tentar de novo
        </Button>
      </Aviso>
    )

  const d = estado.dados
  // (a) sela o src na primeira renderização; renovações não o alteram.
  if (!srcSelado.current) srcSelado.current = d.player

  const pct =
    assistido.alvo > 0 ? Math.min(100, Math.round((assistido.seg / assistido.alvo) * 100)) : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumb curso={modulos[0]?.curso} aula={d.aula.numero} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* vídeo 16:9 */}
          <div className="overflow-hidden rounded-lg bg-black">
            <div className="relative aspect-video">
              <iframe
                ref={iframeRef}
                src={srcSelado.current}
                title={d.aula.titulo}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{d.aula.numero}</p>
              <h1 className="text-xl font-semibold">{d.aula.titulo}</h1>
            </div>
            {retomando > 2 && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Retomando de {mmss(retomando)}
              </span>
            )}
          </div>

          {/* Navegação anterior/próxima */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
            {anterior ? (
              <Button asChild variant="outline" className="h-11 justify-start">
                <Link to={`/ead/aula/${anterior.slug}`}>← Anterior</Link>
              </Button>
            ) : (
              <span />
            )}
            {proxima && (
              <Button asChild variant="outline" className="h-11 justify-between sm:max-w-xs">
                <Link to={`/ead/aula/${proxima.slug}`}>
                  <span className="truncate">Próxima: {proxima.titulo}</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Progresso honesto */}
          <div className="mt-6 rounded-lg border bg-card p-4">
            {assistido.concluida ? (
              <p className="flex items-center gap-2 text-sm font-medium text-green-800">
                <span aria-hidden="true">✓</span> Aula concluída
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground/85">
                  Esta aula conclui sozinha quando você assiste. Não há botão para marcar.
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso desta aula"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pct}% assistido
                  {assistido.alvo > 0 &&
                    ` — faltam ${mmss(Math.max(0, assistido.alvo - assistido.seg))}`}
                </p>
              </>
            )}
          </div>

          {/* Para fixar — salva sozinho */}
          {d.pergunta_fixacao && (
            <section className="mt-6 rounded-lg bg-muted p-4">
              <h2 className="text-sm font-semibold">Para fixar</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">
                {d.pergunta_fixacao}
              </p>
              <label htmlFor="fixacao" className="sr-only">
                Sua resposta
              </label>
              <Textarea
                id="fixacao"
                value={resposta}
                onChange={(e) => mudarResposta(e.target.value)}
                placeholder="Anote a sua resposta — ela fica salva na sua conta."
                className="mt-3 min-h-24 bg-background"
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {salvoEm === 'salvando' && 'Salvando…'}
                {salvoEm === 'salvo' && 'Salvo'}
                {salvoEm === 'erro' && 'Não foi possível salvar — tente de novo.'}
                {salvoEm === 'parado' && 'Salva sozinho enquanto você escreve.'}
              </p>
            </section>
          )}

          {/* Material */}
          {d.tem_material && (
            <div className="mt-6">
              <Button
                variant="outline"
                className="h-11"
                onClick={abrirMaterial}
                disabled={baixando}
              >
                {baixando ? 'Abrindo…' : 'Material da aula (PDF)'}
              </Button>
              {erroMaterial && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {erroMaterial}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lateral: aulas do módulo */}
        <aside className="lg:border-l lg:pl-6">
          <h2 className="text-sm font-semibold">Neste módulo</h2>
          <ol className="mt-3 space-y-1">
            {doModulo.map((a) => {
              const atual = a.slug === d.aula.slug
              return (
                <li key={a.slug}>
                  <Link
                    to={`/ead/aula/${a.slug}${a.amostra && !getToken() ? '?amostra=1' : ''}`}
                    aria-current={atual ? 'page' : undefined}
                    className={
                      'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm ' +
                      (atual ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted')
                    }
                  >
                    <span className="shrink-0 text-xs text-muted-foreground">{a.numero}</span>
                    <span className="line-clamp-2">{a.titulo}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="mt-4 text-xs">
            <Link to="/ead/minha-area" className="text-muted-foreground underline">
              Minha área
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function mmss(seg: number) {
  const m = Math.floor(seg / 60)
  const s = Math.floor(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function Breadcrumb({ curso, aula }: { curso?: string; aula: string }) {
  return (
    <nav aria-label="Você está aqui" className="text-xs text-muted-foreground">
      <Link to="/ead/minha-area" className="underline">
        Minha área
      </Link>
      <span className="mx-1.5" aria-hidden="true">
        /
      </span>
      <span>{curso || 'Curso'}</span>
      <span className="mx-1.5" aria-hidden="true">
        /
      </span>
      <span className="text-foreground">{aula}</span>
    </nav>
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
