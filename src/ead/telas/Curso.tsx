// Curso.tsx → /ead/:cursoSlug — página do curso (vitrine).
//
// ── CENÁRIO APROVADO (20/11, opção ii) ────────────────────────────────────
// Visitante vê: título, resumo, módulos, quantas aulas, preço e a AULA ISCA
// (com link "assistir"). Não vê o título das aulas pagas — para essas, a linha
// mostra número e duração com CADEADO, e o cadeado é um LINK para a compra.
//
// ── POR QUE TUDO VEM DE /backend/v1/ead/curso/{slug} ──────────────────────
// A coleção `aulas` está fechada ao visitante de propósito (ver
// portao-listagem.pb.js): regra de linha não esconde campo, então o título pago
// vazaria junto. Este endpoint monta a resposta campo a campo e decide o que
// cada perfil recebe.
//
// ── O QUE MUDOU NESTA VERSÃO ──────────────────────────────────────────────
// 1. Lê a vitrine em vez de `estruturaDoCurso` (que dependia de `aulas` e
//    quebrava com 403).
// 2. `api.produtos()` agora tem `.catch`: com a área fechada ele devolvia 403 e
//    derrubava a página inteira em "Não foi possível carregar". Produto ausente
//    só significa "sem preço", e sem preço a tela mostra o aviso certo.
// 3. O link da isca leva `?amostra=1`. Sem o parâmetro, o Player chama a rota
//    autenticada e o visitante recebe 401 mesmo na aula que é grátis.
// 4. O cadeado virou <Link> para /ead/comprar — clicar numa aula paga leva à
//    aquisição, como o dono pediu.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiLote2, precoBR, duracaoBR, type Produto } from '../api'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

type Vitrine = {
  curso: {
    id: string
    slug: string
    titulo: string
    resumo: string
    resultado: string
    descricao: string
    carga_min: number
  }
  modulos: Array<{ id: string; titulo: string; ordem: number }>
  aulas: Array<{
    id: string
    modulo: string
    numero: string
    ordem: number
    duracao_seg: number
    amostra: boolean
    liberada: boolean
    slug?: string
    titulo?: string
  }>
  total_aulas: number
  total_seg: number
  tem_matricula: boolean
}

export default function Curso() {
  const { cursoSlug = '' } = useParams<{ cursoSlug: string }>()
  const [v, setV] = useState<Vitrine | null>(null)
  const [produto, setProduto] = useState<Produto | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao_encontrado' | 'erro'>(
    'carregando',
  )

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const dados = await apiLote2.vitrine(cursoSlug)
        if (!vivo) return
        setV(dados)

        // Preço: produto ativo que inclui este curso.
        // `.catch` é obrigatório: com a área fechada a listagem devolve 403 e,
        // sem o catch, a página inteira cairia em "erro".
        const prods = await api.produtos().catch(() => [])
        const deste = prods.find((p) => p.ativo && p.cursos.includes(dados.curso.id))
        if (vivo) {
          setProduto(deste ?? null)
          setEstado('ok')
        }
      } catch {
        if (vivo) setEstado('nao_encontrado')
      }
    })()
    return () => {
      vivo = false
    }
  }, [cursoSlug])

  if (estado === 'carregando')
    return <p className="px-4 py-16 text-center text-muted-foreground">Carregando…</p>

  if (estado === 'nao_encontrado' || !v)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Curso não encontrado</h1>
        <Link to="/ead" className="mt-4 inline-block underline">
          Ver todos os cursos
        </Link>
      </div>
    )

  const temPreco = !!produto && produto.preco_centavos > 0
  const cargaHoras =
    v.curso.carga_min > 0 ? Math.max(1, Math.round((v.curso.carga_min / 60) * 10) / 10) : null
  // Quantas aulas abertas (isca) o visitante pode assistir agora.
  const iscas = v.aulas.filter((a) => a.amostra).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 pb-28">
      <nav className="text-sm text-muted-foreground">
        <Link to="/ead" className="underline">
          Cursos
        </Link>{' '}
        / {v.curso.titulo}
      </nav>

      <h1 className="mt-3 text-3xl font-semibold">{v.curso.titulo}</h1>
      {v.curso.resumo && <p className="mt-2 text-lg text-foreground/80">{v.curso.resumo}</p>}

      <p className="mt-3 text-sm text-muted-foreground">
        {v.total_aulas} aulas{v.total_seg > 0 && ` · ${duracaoBR(v.total_seg)} de vídeo`}
      </p>
      {cargaHoras !== null && (
        <p className="mt-1 text-sm text-muted-foreground">
          Carga horária: {cargaHoras} h (vídeos e exercícios de fixação)
        </p>
      )}

      {/* Aviso de isca: o visitante precisa saber que pode assistir ANTES de
          comprar. Sem esta linha, "grátis" na lista parece erro. */}
      {iscas > 0 && !v.tem_matricula && (
        <p className="mt-4 rounded-lg border-l-4 border-accent bg-accent/10 px-4 py-3 text-sm">
          <strong>
            {iscas} aula{iscas === 1 ? '' : 's'} aberta{iscas === 1 ? '' : 's'} para assistir
          </strong>{' '}
          — nenhum cadastro necessário. As demais abrem na íntegra após a compra.
        </p>
      )}

      {v.curso.resultado && (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h2 className="text-sm font-medium">Ao final você sabe</h2>
          <p className="mt-1 whitespace-pre-line text-foreground/80">{v.curso.resultado}</p>
        </div>
      )}

      {v.curso.descricao && (
        <div
          className="prose prose-slate mt-8 max-w-none"
          // Campo editor preenchido por admin, nunca por visitante.
          dangerouslySetInnerHTML={{ __html: v.curso.descricao }}
        />
      )}

      <h2 className="mt-10 text-xl font-semibold">Conteúdo</h2>
      <div className="mt-4 space-y-4">
        {v.modulos.map((m, i) => {
          const doModulo = v.aulas.filter((a) => a.modulo === m.id)
          if (!doModulo.length) return null
          return (
            <section key={m.id} className="rounded-lg border">
              <h3 className="border-b px-4 py-3 font-medium">
                Módulo {i + 1} — {m.titulo}
              </h3>
              <ul className="divide-y">
                {doModulo.map((a) => (
                  <li key={a.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{a.numero}</span>

                    {/* Título só quando liberada. Na paga, o texto é neutro:
                        mostrar "conteúdo do curso" é honesto e não entrega o
                        que a pessoa compra. */}
                    <span className={'flex-1 ' + (a.liberada ? '' : 'text-muted-foreground')}>
                      {a.liberada && a.titulo ? a.titulo : 'Aula do curso'}
                    </span>

                    {a.amostra && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        grátis
                      </span>
                    )}
                    {duracaoBR(a.duracao_seg) && (
                      <span className="text-xs text-muted-foreground">
                        {duracaoBR(a.duracao_seg)}
                      </span>
                    )}

                    {a.liberada ? (
                      <Link
                        // ?amostra=1 é o que faz o Player usar a rota PÚBLICA.
                        // Sem ele, o visitante recebe 401 na aula grátis.
                        to={`/ead/aula/${a.slug}${a.amostra ? '?amostra=1' : ''}`}
                        className="text-sm font-medium underline"
                      >
                        Assistir
                      </Link>
                    ) : (
                      // O cadeado é LINK. Clicar numa aula paga leva à compra.
                      <Link
                        to={temPreco ? `/ead/comprar?produto=${produto!.slug}` : '/ead/comprar'}
                        className="flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
                        aria-label={`Aula ${a.numero}: disponível após a compra`}
                      >
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">disponível após a compra</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {v.aulas.length === 0 && <p className="text-muted-foreground">Conteúdo em preparação.</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          {v.tem_matricula ? (
            <>
              <p className="text-sm text-muted-foreground">Você já tem acesso a este curso.</p>
              <Button asChild size="lg">
                <Link to="/ead/minha-area">Continuar o curso</Link>
              </Button>
            </>
          ) : temPreco ? (
            <>
              <span className="text-xl font-semibold">{precoBR(produto!.preco_centavos)}</span>
              <Button asChild size="lg">
                <Link to={`/ead/comprar?produto=${produto!.slug}`}>Comprar</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Este curso ainda não está à venda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
