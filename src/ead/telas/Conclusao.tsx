// Conclusao.tsx → /ead/:cursoSlug/conclusao
//
// ITEM 6 DO LOTE 2. Junta três coisas que acontecem no mesmo momento: o
// certificado, o pré-diagnóstico e o pedido de conversa.
//
// ORDEM NA TELA (importa): selo e título → certificado → pré-diagnóstico →
// cartão escuro do WhatsApp. O pedido de conversa vem DEPOIS do pré-diagnóstico
// porque o pré-diagnóstico é a entrega; pedir a reunião antes de entregar o
// valor inverteria a ordem.
//
// O PRÉ-DIAGNÓSTICO É UMA PERGUNTA SÓ DEPOIS DO CURSO: momento e prazo. As
// outras respostas já vieram do diagnóstico do começo. Mudar a resposta refaz a
// montagem no servidor (o código PD continua o mesmo).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiLote2, ErroApi, type PreDiagnostico } from '../api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const MOMENTOS = [
  { v: 'estudando', r: 'Ainda estudando o assunto' },
  { v: 'avaliando', r: 'Avaliando uma solução' },
  { v: 'projeto_aprovado', r: 'Projeto aprovado' },
  { v: 'tem_wms', r: 'Já tenho WMS e quero melhorar' },
]

const PRAZOS = [
  { v: 'ate_3m', r: 'Até 3 meses' },
  { v: 'de_3a6m', r: 'De 3 a 6 meses' },
  { v: 'de_6a12m', r: 'De 6 a 12 meses' },
  { v: 'sem_prazo', r: 'Sem prazo definido' },
]

export default function Conclusao() {
  const { cursoSlug = '' } = useParams<{ cursoSlug: string }>()

  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [progresso, setProgresso] = useState<{ concluidas: number; total: number }>({
    concluidas: 0,
    total: 0,
  })
  const [certificado, setCertificado] = useState<any>(null)
  const [emitindo, setEmitindo] = useState(false)
  const [erroCert, setErroCert] = useState('')

  const [momento, setMomento] = useState('')
  const [prazo, setPrazo] = useState('')
  const [pd, setPd] = useState<PreDiagnostico | null>(null)
  const [montando, setMontando] = useState(false)
  const [erroPd, setErroPd] = useState('')

  const [enviarAnotacoes, setEnviarAnotacoes] = useState(true)
  const [abrindoWhats, setAbrindoWhats] = useState(false)
  const [erroWhats, setErroWhats] = useState('')
  const [urlWhats, setUrlWhats] = useState('')

  const [proximoCurso, setProximoCurso] = useState<{ titulo: string; slug: string } | null>(null)
  const [anotacoes, setAnotacoes] = useState<{ total: number }>({ total: 0 })

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga('')
    try {
      const [prog, curso] = await Promise.all([
        api.progressoCurso(cursoSlug).catch(() => null),
        api.cursoPorSlug(cursoSlug).catch(() => null),
      ])
      if (prog) setProgresso({ concluidas: prog.concluidas ?? 0, total: prog.total ?? 0 })

      const r = await apiLote2.prediagnostico(cursoSlug).catch(() => null)
      if (r?.existe && r.prediagnostico) {
        setPd(r.prediagnostico)
        setMomento(r.prediagnostico.momento)
        setPrazo(r.prediagnostico.prazo)
        setEnviarAnotacoes(r.prediagnostico.enviar_anotacoes)
      }

      // próximos cursos (em_breve) e contagem de anotações
      const emBreve = await apiLote2.cursosEmBreve().catch(() => [])
      if (emBreve.length) setProximoCurso({ titulo: emBreve[0].titulo, slug: emBreve[0].slug })

      if (curso) {
        const a = await api.contarAnotacoes(cursoSlug).catch(() => ({ total: 0 }))
        setAnotacoes(a)
      }
    } catch {
      setErroCarga('Não foi possível carregar a conclusão agora.')
    } finally {
      setCarregando(false)
    }
  }, [cursoSlug])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function emitir() {
    setEmitindo(true)
    setErroCert('')
    try {
      const c = await api.emitirCertificado(cursoSlug)
      setCertificado(c)
    } catch (err) {
      setErroCert(
        err instanceof ErroApi ? err.message : 'Não foi possível emitir o certificado agora.',
      )
    } finally {
      setEmitindo(false)
    }
  }

  async function montarPrediagnostico(m: string, p: string) {
    setMomento(m)
    setPrazo(p)
    setErroPd('')
    if (!m || !p) return
    setMontando(true)
    try {
      await apiLote2.montarPrediagnostico({ curso: cursoSlug, momento: m, prazo: p })
      const r = await apiLote2.prediagnostico(cursoSlug)
      if (r.prediagnostico) setPd(r.prediagnostico)
    } catch (err) {
      if (err instanceof ErroApi && err.status === 409) {
        setErroPd(err.message)
      } else {
        setErroPd('Não foi possível montar o pré-diagnóstico agora.')
      }
    } finally {
      setMontando(false)
    }
  }

  async function falarNoWhats() {
    if (!pd) return
    setAbrindoWhats(true)
    setErroWhats('')
    try {
      const r = await apiLote2.aprofundar(pd.codigo, enviarAnotacoes)
      setUrlWhats(r.url)
      window.open(r.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      if (err instanceof ErroApi && err.status === 503) {
        setErroWhats(
          'O contato por WhatsApp ainda não está configurado. Fale com o suporte por e-mail e a gente combina o melhor horário.',
        )
      } else {
        setErroWhats('Não foi possível abrir o WhatsApp agora.')
      }
    } finally {
      setAbrindoWhats(false)
    }
  }

  if (carregando)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    )

  if (erroCarga)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Não conseguimos abrir esta tela</h1>
        <p className="mt-2 text-muted-foreground">{erroCarga}</p>
        <Button variant="outline" className="mt-6 h-11" onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    )

  const pct = progresso.total > 0 ? Math.round((progresso.concluidas / progresso.total) * 100) : 0
  const nomeAluno = certificado?.nome || ''

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {progresso.concluidas} de {progresso.total} aulas
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Curso concluído{nomeAluno ? `, ${nomeAluno.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Seu certificado está pronto e o pré-diagnóstico da sua operação também.
          </p>

          {/* ---------------- certificado ---------------- */}
          <section className="mt-8 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Seu certificado</h2>
            {!certificado ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Emitimos com o seu nome, o curso, a data e um código de validação pública.
                </p>
                <Button className="mt-4 h-11" onClick={emitir} disabled={emitindo}>
                  {emitindo ? 'Emitindo…' : 'Emitir meu certificado'}
                </Button>
                {erroCert && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {erroCert}
                  </p>
                )}
              </>
            ) : (
              <>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Nome</dt>
                    <dd className="font-medium">{certificado.nome}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Curso</dt>
                    <dd className="font-medium">{certificado.curso}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Data</dt>
                    <dd>{certificado.data}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Código</dt>
                    <dd className="font-mono">{certificado.codigo}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="h-11">
                    <Link
                      to={`/ead/imprimir/certificado/${encodeURIComponent(certificado.codigo)}`}
                      target="_blank"
                      rel="noopener"
                    >
                      Baixar PDF
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11">
                    <a href={linkedinUrl(certificado)} target="_blank" rel="noopener noreferrer">
                      Adicionar ao LinkedIn
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        `${window.location.origin}/certificado/${certificado.codigo}`,
                      )
                    }}
                  >
                    Copiar link de validação
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* ---------------- pré-diagnóstico ---------------- */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">
              {pd ? 'Seu pré-diagnóstico' : 'Uma última pergunta para fechar o pré-diagnóstico'}
            </h2>

            <div className="mt-4 space-y-5">
              <PerguntaChips
                titulo="Em que momento a empresa está?"
                opcoes={MOMENTOS}
                valor={momento}
                onChange={(v) => montarPrediagnostico(v, prazo)}
              />
              <PerguntaChips
                titulo="Em quanto tempo a decisão precisa acontecer?"
                opcoes={PRAZOS}
                valor={prazo}
                onChange={(v) => montarPrediagnostico(momento, v)}
              />
            </div>

            {montando && <p className="mt-3 text-sm text-muted-foreground">Montando…</p>}
            {erroPd && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {erroPd}
              </p>
            )}

            {pd && (
              <div className="mt-6 rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
                  <p className="text-sm font-semibold">Pré-diagnóstico da sua operação</p>
                  <p className="font-mono text-xs text-muted-foreground">{pd.codigo}</p>
                </div>

                <Bloco titulo="Perfil">
                  <p className="text-sm text-foreground/85">
                    {rotulo(MOMENTOS, pd.snapshot.perfil.controle_atual) &&
                      `Controle atual: ${rotuloControle(pd.snapshot.perfil.controle_atual)}. `}
                    {pd.snapshot.perfil.papel &&
                      `Papel: ${rotuloPapel(pd.snapshot.perfil.papel)}. `}
                    {pd.snapshot.perfil.porte && `Porte: ${rotuloPorte(pd.snapshot.perfil.porte)}.`}
                  </p>
                </Bloco>

                <Bloco titulo="Maturidade estimada">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-primary">{pd.nivel}</span>
                    <div className="flex gap-1" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={
                            'h-2.5 w-8 rounded-sm ' + (n <= pd.nivel ? 'bg-primary' : 'bg-muted')
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">de 5</span>
                  </div>
                  {pd.snapshot.nivel.texto && (
                    <p className="mt-2 text-sm text-foreground/80">{pd.snapshot.nivel.texto}</p>
                  )}
                </Bloco>

                <Bloco titulo="Pontos de atenção">
                  <ul className="space-y-3">
                    {pd.snapshot.pontos_de_atencao.map((p, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium">{p.dor}</p>
                        {p.texto && <p className="mt-0.5 text-foreground/75">{p.texto}</p>}
                        {p.aula_base && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Aula base:{' '}
                            <Link to={`/ead/aula/${p.aula_base.slug}`} className="underline">
                              {p.aula_base.numero} — {p.aula_base.titulo}
                            </Link>{' '}
                            {p.aula_base.concluida ? '· já concluída' : ''}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Bloco>

                {pd.snapshot.proximo_passo && (
                  <Bloco titulo="Próximo passo sugerido">
                    <p className="text-sm text-foreground/85">{pd.snapshot.proximo_passo}</p>
                  </Bloco>
                )}

                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  Este pré-diagnóstico é uma leitura a partir das suas respostas. Ele não mede a sua
                  operação e não substitui uma análise com dados reais.
                </p>
              </div>
            )}

            {/* ---------------- cartão escuro do WhatsApp ---------------- */}
            {pd && (
              <div className="mt-6 rounded-xl bg-[#0f172a] p-5 text-white sm:p-6">
                <h3 className="text-lg font-semibold">
                  Aprofundar o diagnóstico com o time da Zion
                </h3>
                <p className="mt-2 text-sm text-white/80">
                  Uma conversa de 30 minutos sobre o seu caso, com quem já implantou em operações
                  parecidas. Você sai com os próximos passos, com ou sem projeto.
                </p>

                <div className="mt-4 flex items-start gap-3">
                  <Checkbox
                    id="enviar-anotacoes"
                    checked={enviarAnotacoes}
                    onCheckedChange={(v) => setEnviarAnotacoes(v === true)}
                    className="mt-0.5 border-white/40 data-[state=checked]:bg-accent"
                  />
                  <Label
                    htmlFor="enviar-anotacoes"
                    className="text-sm font-normal leading-relaxed text-white/90"
                  >
                    Enviar também as minhas anotações do curso
                  </Label>
                </div>

                <Button
                  className="mt-4 h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90 sm:w-auto"
                  onClick={falarNoWhats}
                  disabled={abrindoWhats}
                >
                  {abrindoWhats ? 'Abrindo…' : 'Falar com a Zion no WhatsApp'}
                </Button>

                {urlWhats && (
                  <p className="mt-3 break-all text-xs text-white/60">
                    Se o WhatsApp não abrir, use este link: {urlWhats}
                  </p>
                )}
                {erroWhats && (
                  <p role="alert" className="mt-3 text-sm text-amber-300">
                    {erroWhats}
                  </p>
                )}

                <p className="mt-3 text-xs text-white/60">Sem custo e sem compromisso.</p>
              </div>
            )}
          </section>
        </div>

        {/* lateral */}
        <aside className="space-y-6 lg:border-l lg:pl-6">
          <div>
            <h2 className="text-sm font-semibold">Seu progresso no curso</h2>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do curso"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{pct}% concluído</p>
          </div>

          {proximoCurso && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Próximo da série</h2>
              <p className="mt-1 text-sm">{proximoCurso.titulo}</p>
              <Button asChild variant="outline" className="mt-3 h-11 w-full">
                <Link to={`/ead/${proximoCurso.slug}`}>Ver o curso</Link>
              </Button>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Suas anotações do curso</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {anotacoes.total} resposta{anotacoes.total === 1 ? '' : 's'} registrada
              {anotacoes.total === 1 ? '' : 's'}
            </p>
            <Button asChild variant="outline" className="mt-3 h-11 w-full">
              <Link to={`/ead/imprimir/anotacoes/${encodeURIComponent(cursoSlug)}`} target="_blank">
                Ver minhas anotações
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function PerguntaChips({
  titulo,
  opcoes,
  valor,
  onChange,
}: {
  titulo: string
  opcoes: Array<{ v: string; r: string }>
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{titulo} *</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={valor === o.v}
            onClick={() => onChange(o.v)}
            className={
              'min-h-11 rounded-lg border px-4 py-2 text-sm ' +
              (valor === o.v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted')
            }
          >
            {o.r}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// ---- rótulos legíveis (o dado guarda a chave, a tela mostra texto) ----
function rotulo(_o: Array<{ v: string; r: string }>, v: string) {
  return v ? v : ''
}
function rotuloControle(v: string) {
  const m: Record<string, string> = {
    planilha: 'planilhas',
    erp: 'ERP',
    wms_mercado: 'WMS de mercado',
    sistema_proprio: 'sistema próprio',
    implantando: 'em implantação',
  }
  return m[v] || v
}
function rotuloPapel(v: string) {
  const m: Record<string, string> = {
    diretoria: 'diretoria',
    gerencia: 'gerência',
    supervisao: 'supervisão',
    ti: 'TI',
    consultoria: 'consultoria',
    outro: 'outro',
  }
  return m[v] || v
}
function rotuloPorte(v: string) {
  const m: Record<string, string> = {
    ate_2mil: 'até 2.000 m²',
    de_2a10mil: '2.000 a 10.000 m²',
    de_10a30mil: '10.000 a 30.000 m²',
    acima_30mil: 'acima de 30.000 m²',
  }
  return m[v] || v
}

// Link de "adicionar ao perfil" do LinkedIn.
function linkedinUrl(c: any) {
  const emitido = new Date()
  const p = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: c.curso || '',
    organizationName: c.emissor || 'Eduardo Canal',
    issueYear: String(emitido.getFullYear()),
    issueMonth: String(emitido.getMonth() + 1),
    certUrl: `${window.location.origin}/certificado/${c.codigo}`,
    certId: c.codigo,
  })
  return `https://www.linkedin.com/profile/add?${p.toString()}`
}
