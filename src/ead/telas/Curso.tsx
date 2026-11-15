// src/ead/telas/Curso.tsx → rota /ead/:cursoSlug
// Página do curso: descrição, módulos com aulas, cadeado onde não há acesso.
// O cadeado é CONVENIÊNCIA, não segurança: quem barra é o endpoint de playback.
// Carrega as aulas do curso numa consulta e agrupa por módulo no cliente.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  precoBR,
  duracaoBR,
  type Aula,
  type Curso as TCurso,
  type Modulo,
  type Produto,
} from '../api'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export default function Curso() {
  const { cursoSlug = '' } = useParams<{ cursoSlug: string }>()
  const [curso, setCurso] = useState<TCurso | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [produto, setProduto] = useState<Produto | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao_encontrado' | 'erro'>(
    'carregando',
  )

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const c = await api.cursoPorSlug(cursoSlug)
        if (!vivo) return
        if (!c || c.publicado === false) return setEstado('nao_encontrado')
        setCurso(c)

        const { modulos: ms, aulas: as } = await api.estruturaDoCurso(c.id)
        if (!vivo) return
        const doCurso = new Set(ms.map((m) => m.id))
        setModulos([...ms].sort((a, b) => a.ordem - b.ordem))
        setAulas(as.filter((a) => doCurso.has(a.modulo)).sort((a, b) => a.ordem - b.ordem))

        const prods = await api.produtos()
        const deste = prods.find((p) => p.ativo && p.cursos.includes(c.id))
        if (vivo) {
          setProduto(deste ?? null)
          setEstado('ok')
        }
      } catch {
        if (vivo) setEstado('erro')
      }
    })()
    return () => {
      vivo = false
    }
  }, [cursoSlug])

  const totalSeg = useMemo(() => aulas.reduce((s, a) => s + (a.duracao_seg || 0), 0), [aulas])

  if (estado === 'carregando')
    return <p className="px-4 py-16 text-center text-muted-foreground">Carregando…</p>
  if (estado === 'nao_encontrado')
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Curso não encontrado</h1>
        <Link to="/ead" className="mt-4 inline-block underline">
          Ver todos os cursos
        </Link>
      </div>
    )
  if (estado === 'erro')
    return (
      <p role="alert" className="px-4 py-16 text-center text-red-700">
        Não foi possível carregar este curso agora.
      </p>
    )

  const temPreco = !!produto && produto.preco_centavos > 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 pb-28">
      <nav className="text-sm text-muted-foreground">
        <Link to="/ead" className="underline">
          Cursos
        </Link>{' '}
        / {curso!.titulo}
      </nav>

      <h1 className="mt-3 text-3xl font-semibold">{curso!.titulo}</h1>
      {curso!.resumo_1linha && (
        <p className="mt-2 text-lg text-foreground/80">{curso!.resumo_1linha}</p>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        {aulas.length} aulas{totalSeg > 0 && ` · ${duracaoBR(totalSeg)} de vídeo`}
      </p>

      {curso!.resultado_esperado && (
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h2 className="text-sm font-medium">Ao final você sabe</h2>
          <p className="mt-1 whitespace-pre-line text-foreground/80">{curso!.resultado_esperado}</p>
        </div>
      )}

      {curso!.descricao && (
        <div
          className="prose prose-slate mt-8 max-w-none"
          // `descricao` é campo editor preenchido por admin, nunca por visitante.
          dangerouslySetInnerHTML={{ __html: curso!.descricao }}
        />
      )}

      <h2 className="mt-10 text-xl font-semibold">Conteúdo</h2>
      <div className="mt-4 space-y-4">
        {modulos.map((m) => {
          const doModulo = aulas.filter((a) => a.modulo === m.id)
          if (!doModulo.length) return null
          return (
            <section key={m.id} className="rounded-lg border">
              <h3 className="border-b px-4 py-3 font-medium">{m.titulo}</h3>
              <ul className="divide-y">
                {doModulo.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{a.numero}</span>
                    <span className="flex-1">{a.titulo}</span>
                    {a.amostra && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        grátis
                      </span>
                    )}
                    {duracaoBR(a.duracao_seg) && (
                      <span className="text-xs text-muted-foreground">
                        {duracaoBR(a.duracao_seg)}
                      </span>
                    )}
                    {a.amostra ? (
                      <Link to={`/ead/aula/${a.slug}`} className="text-sm underline">
                        assistir
                      </Link>
                    ) : (
                      <Lock
                        className="h-4 w-4 text-muted-foreground"
                        aria-label="disponível após a compra"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {aulas.length === 0 && <p className="text-muted-foreground">Conteúdo em preparação.</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          {temPreco ? (
            <>
              <span className="text-xl font-semibold">{precoBR(produto!.preco_centavos)}</span>
              <Button asChild size="lg">
                <Link to={`/ead/comprar?produto=${produto!.slug}`}>Comprar</Link>
              </Button>
            </>
          ) : (
            // Sem preço não existe botão de compra — e nada de "em breve" com data inventada.
            <p className="text-sm text-muted-foreground">Este curso ainda não está à venda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
