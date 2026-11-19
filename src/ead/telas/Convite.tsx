// Convite.tsx → rota pública /presente/:codigo
//
// ITEM 1 DO LOTE 2. É a porta de entrada do lead presenteado.
//
// ORDEM NA TELA (mobile primeiro, como o pedido define):
//   selo → título → recado → [CARTÃO DE ACESSO no celular] → capa → chips →
//   "o que você vai sair sabendo" → módulos → autor.
// No desktop o cartão fica ao lado (coluna direita), grudado ao rolar; no
// celular ele sobe para logo depois do recado, porque é a única ação da página.
//
// O QUE VEM DO SERVIDOR E O QUE É TEXTO FIXO:
//   servidor: nome do lead, e-mail, recado, título do curso, capa, nº de módulos
//             e de aulas.
//   fixo: os textos de seção, porque são do produto e não variam por convite.
//
// CÓDIGO INVÁLIDO: uma mensagem simples e um link para /ead/entrar. Não dizemos
// se expirou, se já foi usado ou se não existe — o servidor já devolve a mesma
// resposta para os três, e repetir o motivo na tela desfaria essa proteção.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiLote2, ErroApi, type Presente, type ModuloPresente } from '../api'
import { CartaoAcesso } from '../CartaoAcesso'
import { Button } from '@/components/ui/button'
import { getToken } from '../api'

type Estado =
  | { t: 'carregando' }
  | { t: 'ok'; dados: Presente }
  | { t: 'invalido' }
  | { t: 'erro'; msg: string }

export default function Convite() {
  const { codigo = '' } = useParams<{ codigo: string }>()
  const navegar = useNavigate()
  const [estado, setEstado] = useState<Estado>({ t: 'carregando' })
  const [estrutura, setEstrutura] = useState<ModuloPresente[]>([])
  const [resgatando, setResgatando] = useState(false)
  const [erroResgate, setErroResgate] = useState('')

  const carregar = useCallback(async () => {
    setEstado({ t: 'carregando' })
    try {
      const dados = await apiLote2.presente(codigo)
      setEstado({ t: 'ok', dados })
    } catch (err) {
      if (err instanceof ErroApi && err.status === 404) return setEstado({ t: 'invalido' })
      if (err instanceof ErroApi && err.status === 429)
        return setEstado({ t: 'erro', msg: 'Muitas tentativas. Espere um minuto e recarregue.' })
      setEstado({ t: 'erro', msg: 'Não foi possível abrir o convite agora.' })
    }
  }, [codigo])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Estrutura do curso (módulos e contagem de aulas) — rota pública própria,
  // porque `modulos`/`aulas` estão fechadas ao visitante.
  useEffect(() => {
    if (estado.t !== 'ok') return
    let vivo = true
    ;(async () => {
      try {
        const d = await apiLote2.estruturaPresente(codigo)
        if (vivo) setEstrutura(d.modulos ?? [])
      } catch {
        /* a lista de módulos é complemento: sem ela a página continua útil */
      }
    })()
    return () => {
      vivo = false
    }
  }, [estado, codigo])

  // Depois de logar: resgata e segue para o diagnóstico.
  async function aposEntrar() {
    setErroResgate('')
    setResgatando(true)
    try {
      const r = await apiLote2.resgatarPresente(codigo)
      navegar(`/ead/${r.curso.slug}/diagnostico`, { replace: true })
    } catch (err) {
      if (err instanceof ErroApi && err.status === 403) {
        setErroResgate(
          'Este convite foi feito para outro e-mail. Saia e entre com o e-mail que recebeu o convite.',
        )
      } else if (err instanceof ErroApi && err.status === 404) {
        setErroResgate('Este convite não está mais disponível.')
      } else {
        setErroResgate('Não foi possível abrir o presente agora. Tente de novo.')
      }
    } finally {
      setResgatando(false)
    }
  }

  if (estado.t === 'carregando')
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-muted" />
        <div className="mt-3 h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    )

  if (estado.t === 'invalido')
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Este convite não está disponível</h1>
        <p className="mt-2 text-muted-foreground">
          O link pode ter expirado ou já ter sido usado. Você ainda pode entrar com o seu e-mail.
        </p>
        <Button asChild className="mt-6 h-11">
          <Link to="/ead/entrar">Entrar com o meu e-mail</Link>
        </Button>
      </div>
    )

  if (estado.t === 'erro')
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Não conseguimos abrir o convite</h1>
        <p className="mt-2 text-muted-foreground">{estado.msg}</p>
        <Button variant="outline" className="mt-6 h-11" onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    )

  const d = estado.dados
  const jaLogado = !!getToken()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
        {/* ---------------- coluna principal ---------------- */}
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
            Convite pessoal
          </span>

          <h1 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl">
            {d.nome_lead || 'Você'}, o Eduardo Canal separou este curso para você.
          </h1>

          {/* Recado + foto do autor */}
          {d.recado && (
            <div className="mt-5 flex gap-3 rounded-xl bg-muted/60 p-4">
              <img
                src="/autor.jpg"
                alt=""
                aria-hidden="true"
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              <blockquote className="text-sm leading-relaxed text-foreground/85">
                {d.recado}
                <footer className="mt-2 text-xs font-medium text-muted-foreground">
                  Eduardo Canal
                </footer>
              </blockquote>
            </div>
          )}

          {/* CARTÃO NO CELULAR: logo após o recado, antes do conteúdo */}
          <div className="mt-6 lg:hidden">
            <BlocoAcesso
              d={d}
              jaLogado={jaLogado}
              codigo={codigo}
              resgatando={resgatando}
              erro={erroResgate}
              aposEntrar={aposEntrar}
            />
          </div>

          {/* Capa + chips */}
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
            {d.curso.capa && (
              <img
                src={d.curso.capa}
                alt={`Capa do curso ${d.curso.titulo}`}
                className="h-40 w-auto shrink-0 rounded-lg object-cover shadow-sm"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{d.curso.titulo}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>{d.curso.modulos} módulos</Chip>
                <Chip>{d.curso.aulas} aulas</Chip>
                <Chip>Certificado incluso</Chip>
              </div>
            </div>
          </div>

          {/* O que você vai sair sabendo */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold">O que você vai sair sabendo</h2>
            <ul className="mt-3 space-y-2 text-sm text-foreground/85">
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-primary">
                  ✓
                </span>
                Onde a operação in house perde dinheiro, ponto por ponto.
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-primary">
                  ✓
                </span>
                Como integrar ERP, WMS, TMS e OMS sem retrabalho manual.
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-primary">
                  ✓
                </span>
                Como medir o que hoje você só acha que sabe sobre o armazém.
              </li>
            </ul>
          </section>

          {/* Módulos */}
          {estrutura.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Como o curso está organizado</h2>
              <ol className="mt-3 space-y-2">
                {estrutura.map((m, i) => (
                  <li key={m.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {i + 1}. {m.titulo}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {m.aulas} aula{m.aulas === 1 ? '' : 's'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Autor */}
          <section className="mt-10 rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Sobre o autor</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">
              Eduardo Canal escreveu o livro que deu origem a este curso e trabalha com operação
              logística in house há mais de duas décadas — do chão de armazém à escolha do sistema.
            </p>
          </section>
        </div>

        {/* ---------------- coluna do cartão (desktop) ---------------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <BlocoAcesso
              d={d}
              jaLogado={jaLogado}
              codigo={codigo}
              resgatando={resgatando}
              erro={erroResgate}
              aposEntrar={aposEntrar}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground/80">
      {children}
    </span>
  )
}

function BlocoAcesso({
  d,
  jaLogado,
  codigo,
  resgatando,
  erro,
  aposEntrar,
}: {
  d: Presente
  jaLogado: boolean
  codigo: string
  resgatando: boolean
  erro: string
  aposEntrar: () => void
}) {
  return (
    <div>
      {jaLogado ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Você já está conectado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Falta só abrir o presente na sua conta.
          </p>
          <Button className="mt-4 h-11 w-full" onClick={aposEntrar} disabled={resgatando}>
            {resgatando ? 'Abrindo…' : 'Abrir o meu presente'}
          </Button>
          {erro && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {erro}
            </p>
          )}
        </div>
      ) : (
        <CartaoAcesso
          nomeInicial={d.nome_lead}
          emailInicial={d.email_destino}
          // O mockup mostra o e-mail EDITÁVEL, com a linha "Veio preenchido
          // pelo convite. Pode trocar se preferir outro e-mail." — mas o
          // servidor recusa o resgate com outro e-mail quando `so_este_email`.
          // Manter travado evita a pessoa trocar, entrar e bater num 403 sem
          // entender por quê. Se o dono desmarcar "válido só para este e-mail",
          // o campo abre.
          emailTravado={d.so_este_email}
          codigoConvite={codigo}
          onEntrou={aposEntrar}
        />
      )}
    </div>
  )
}
