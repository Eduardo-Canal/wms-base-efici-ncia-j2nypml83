// MinhaArea.tsx → /ead/minha-area — ITEM 4 DO LOTE 2.
//
// O MOCKUP MOSTRA O QUE MANDA AQUI:
//   saudação → "Recomendada para você" (aula da dor declarada, com botão
//   "Começar esta aula" e o link discreto "Prefiro começar pela aula 1") →
//   módulos em acordeão com a marca "Recomendada" → próximos cursos → livro.
//   A lateral traz o progresso e a nota do certificado.
//
// A RECOMENDAÇÃO VEM DO SERVIDOR: é a mesma regra do diagnóstico e do
// pré-diagnóstico (porta de entrada da dor; sem ela, a de menor ordem). Se o
// aluno não declarou dor, não há recomendação — e a tela mostra "Continuar de
// onde parou" em vez de inventar uma aula.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  apiLote2,
  ErroApi,
  getToken,
  type Aula,
  type Modulo,
  type CursoEmBreve,
  type DiagnosticoResposta,
} from '../api'
import { Button } from '@/components/ui/button'

export default function MinhaArea() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [curso, setCurso] = useState<{ slug: string; titulo: string } | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set())
  const [emBreve, setEmBreve] = useState<CursoEmBreve[]>([])
  const [recomendada, setRecomendada] = useState<{ aula: Aula; motivo: string } | null>(null)
  const [aberto, setAberto] = useState<string>('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    if (!getToken()) {
      setCarregando(false)
      return
    }
    try {
      const perfil = await api.meuPerfil().catch(() => null)
      if (perfil) setNome(perfil.name || '')
      else
        await api
          .carregarPerfil()
          .then((p) => setNome(p?.name || ''))
          .catch(() => {})

      // Matrículas: a `matriculas` é do aluno; o curso vem por expand.
      const mats = await api.minhasMatriculas()
      if (!mats.length) {
        setCurso(null)
        setConcluidas(new Set())
        const eb = await apiLote2.cursosEmBreve().catch(() => [])
        setEmBreve(eb)
        setCarregando(false)
        return
      }

      const m = mats[0]
      const c = await api.cursoPorSlug(m.curso_slug)
      if (!c) throw new Error('curso não encontrado')
      setCurso({ slug: c.slug, titulo: c.titulo })

      const est = await api.estruturaDoCurso(c.id)
      const ids = new Set(est.modulos.map((x) => x.id))
      const minhas = est.aulas.filter((a) => ids.has(a.modulo))
      setModulos(est.modulos)
      setAulas(minhas)

      const prog = await api.progressoCurso(c.slug).catch(() => null)
      const done = new Set<string>(
        (prog?.aulas ?? []).filter((a: any) => a.concluida).map((a: any) => a.slug),
      )
      setConcluidas(done)

      // Recomendação: primeira dor do diagnóstico → aula base.
      const diag: DiagnosticoResposta | null = await apiLote2.diagnostico(c.slug).catch(() => null)
      if (diag?.existe && diag.diagnostico && diag.diagnostico.dores.length) {
        const r = await apiLote2.aulaDaDor(diag.diagnostico.dores[0], c.slug).catch(() => null)
        if (r?.encontrada && r.aula) {
          const alvo = minhas.find((a) => a.slug === r.aula!.slug)
          if (alvo) {
            setRecomendada({
              aula: alvo,
              motivo: `Você apontou ${r.dor} como a maior dor da operação.`,
            })
            setAberto(alvo.modulo)
          }
        }
      }
      if (!aberto && est.modulos.length) setAberto(est.modulos[0].id)

      const eb = await apiLote2.cursosEmBreve().catch(() => [])
      setEmBreve(eb)
    } catch (err) {
      if (err instanceof ErroApi && (err.status === 401 || err.status === 403)) {
        setErro('')
      } else {
        setErro('Não foi possível carregar a sua área agora.')
      }
    } finally {
      setCarregando(false)
    }
  }, [aberto])

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Continuar de onde parou": próxima não concluída na ordem do curso.
  const continuar = useMemo(() => {
    if (!aulas.length) return null
    return aulas.find((a) => !concluidas.has(a.slug)) ?? null
  }, [aulas, concluidas])

  const total = aulas.length
  const feitas = aulas.filter((a) => concluidas.has(a.slug)).length
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0
  const todasConcluidas = total > 0 && feitas >= total

  if (carregando)
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )

  if (!getToken())
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Entre para ver a sua área</h1>
        <p className="mt-2 text-muted-foreground">
          Seus cursos, o seu progresso e o seu certificado ficam aqui.
        </p>
        <Button asChild className="mt-6 h-11">
          <Link to="/ead/entrar?voltar=/ead/minha-area">Entrar com o meu e-mail</Link>
        </Button>
      </div>
    )

  if (erro)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Algo saiu errado</h1>
        <p className="mt-2 text-muted-foreground">{erro}</p>
        <Button variant="outline" className="mt-6 h-11" onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    )

  // ---------- estado vazio: sem matrícula ----------
  if (!curso)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold">Olá{nome ? `, ${nome.split(' ')[0]}` : ''}.</h1>

        <div className="mt-6 rounded-xl border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Você ainda não tem um curso ativo</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Quando você receber um convite, o curso aparece aqui automaticamente. Se comprou, use o
            mesmo e-mail da compra.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="h-11">
              <Link to="/ead">Ver os cursos</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link to="/ead/voucher">Tenho um código</Link>
            </Button>
          </div>
        </div>

        <ProximosCursos cursos={emBreve} />
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold">Olá{nome ? `, ${nome.split(' ')[0]}` : ''}.</h1>
      <p className="mt-1 text-muted-foreground">
        {recomendada
          ? 'Separamos um ponto de partida a partir do que você contou sobre a sua operação.'
          : 'Continue de onde parou ou reveja qualquer aula.'}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {/* ---- Recomendada / Continuar ---- */}
          {recomendada ? (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b bg-accent/10 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                  ★ Recomendada para você
                </p>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative grid aspect-video w-full shrink-0 place-items-center rounded-lg bg-primary/90 sm:w-56">
                    <span className="text-4xl text-white/90" aria-hidden="true">
                      ▶
                    </span>
                    <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {recomendada.aula.numero}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{recomendada.aula.titulo}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{recomendada.motivo}</p>
                    <Button asChild className="mt-3 h-11">
                      <Link to={`/ead/aula/${recomendada.aula.slug}`}>Começar esta aula</Link>
                    </Button>
                    {aulas[0] && aulas[0].slug !== recomendada.aula.slug && (
                      <p className="mt-2">
                        <Link
                          to={`/ead/aula/${aulas[0].slug}`}
                          className="text-xs text-muted-foreground underline"
                        >
                          Prefiro começar pela {aulas[0].numero.toLowerCase()}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            continuar && (
              <section className="rounded-xl border bg-card p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Continuar de onde parou
                </h2>
                <p className="mt-1 text-base font-medium">
                  {continuar.numero} — {continuar.titulo}
                </p>
                <Button asChild className="mt-3 h-11">
                  <Link to={`/ead/aula/${continuar.slug}`}>Continuar a aula</Link>
                </Button>
              </section>
            )
          )}

          {/* ---- Conteúdo do curso (acordeão) ---- */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Conteúdo do curso</h2>
            <div className="mt-3 space-y-2">
              {modulos.map((m, i) => {
                const doModulo = aulas.filter((a) => a.modulo === m.id)
                const abertos = aberto === m.id
                const feitasMod = doModulo.filter((a) => concluidas.has(a.slug)).length
                return (
                  <div key={m.id} className="overflow-hidden rounded-lg border bg-card">
                    <button
                      type="button"
                      onClick={() => setAberto(abertos ? '' : m.id)}
                      aria-expanded={abertos}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium">
                        Módulo {i + 1} — {m.titulo}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {doModulo.length} aulas
                        {feitasMod > 0 && (
                          <span className="text-green-700">
                            {feitasMod}/{doModulo.length}
                          </span>
                        )}
                        <span aria-hidden="true">{abertos ? '−' : '+'}</span>
                      </span>
                    </button>
                    {abertos && (
                      <ol className="border-t">
                        {doModulo.map((a) => {
                          const feita = concluidas.has(a.slug)
                          const ehRecomendada = recomendada?.aula.slug === a.slug
                          return (
                            <li key={a.slug} className="border-b last:border-0">
                              <Link
                                to={`/ead/aula/${a.slug}`}
                                className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted"
                              >
                                <span
                                  aria-hidden="true"
                                  className={
                                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ' +
                                    (feita
                                      ? 'border-green-600 bg-green-600 text-white'
                                      : 'border-muted-foreground/40')
                                  }
                                >
                                  {feita ? '✓' : ''}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="text-xs text-muted-foreground">{a.numero}</span>{' '}
                                  <span className={feita ? 'text-foreground/60' : ''}>
                                    {a.titulo}
                                  </span>
                                </span>
                                {ehRecomendada && (
                                  <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                                    Recomendada
                                  </span>
                                )}
                              </Link>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {todasConcluidas && (
            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Você concluiu as {total} aulas.</p>
              <Button asChild className="mt-3 h-11">
                <Link to={`/ead/${curso.slug}/conclusao`}>Ver o meu certificado</Link>
              </Button>
            </div>
          )}

          <ProximosCursos cursos={emBreve} />
        </div>

        {/* ---- lateral ---- */}
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{curso.titulo}</h2>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do curso"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {feitas} de {total} aulas concluídas · {pct}%
            </p>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              O certificado é liberado ao concluir as {total} aulas.
            </p>
          </div>

          <div className="rounded-xl bg-primary p-4 text-primary-foreground">
            <p className="text-xs uppercase tracking-wide opacity-80">O livro completo</p>
            <p className="mt-1 text-sm font-semibold">Guia Masterclass de Implementação WMS</p>
            <Button asChild variant="secondary" className="mt-3 h-11 w-full">
              <a
                href="https://www.amazon.com.br/dp/B0DK3J8QZP"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver na Amazon
              </a>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ProximosCursos({ cursos }: { cursos: CursoEmBreve[] }) {
  const [avisados, setAvisados] = useState<Record<string, boolean>>({})
  if (!cursos.length) return null

  async function avisar(slug: string) {
    try {
      const r = await apiLote2.avisarLancamento(slug)
      setAvisados((a) => ({ ...a, [slug]: true }))
      void r
    } catch {
      /* mantém o botão para tentar de novo */
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Próximos cursos da série</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cursos.map((c) => (
          <div key={c.slug} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-accent-foreground">{c.aulas_previstas} aulas</p>
            <h3 className="mt-1 text-sm font-semibold">{c.titulo}</h3>
            {c.descricao_curta && (
              <p className="mt-1 text-xs text-muted-foreground">{c.descricao_curta}</p>
            )}
            <Button
              variant="outline"
              className="mt-3 h-11 w-full"
              onClick={() => avisar(c.slug)}
              disabled={avisados[c.slug]}
            >
              {avisados[c.slug] ? 'Vamos te avisar' : 'Avise-me no lançamento'}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
