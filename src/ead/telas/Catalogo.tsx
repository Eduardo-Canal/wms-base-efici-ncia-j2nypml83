// src/ead/telas/Catalogo.tsx → rota /ead
// Lista os produtos ATIVOS. Produto com preco_centavos = 0 NÃO renderiza:
// 0 é "preço ainda não definido", e card sem preço vira promessa quebrada.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, precoBR, duracaoBR, type Produto, type Curso } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CardProduto extends Produto {
  cursosExpandidos: Curso[]
}

export default function Catalogo({ logado }: { logado: boolean }) {
  const [cards, setCards] = useState<CardProduto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    api
      .produtos()
      .then((ps) => {
        if (!vivo) return
        const visiveis = ps
          .filter((p) => p.ativo && p.preco_centavos > 0) // 0 = sem preço
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((p) => ({ ...p, cursosExpandidos: extrairCursos(p) }))
        setCards(visiveis)
      })
      .catch(() => vivo && setErro('Não foi possível carregar os cursos agora.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  if (carregando)
    return <p className="px-4 py-16 text-center text-muted-foreground">Carregando cursos…</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Cursos</h1>
      <p className="mt-2 text-muted-foreground">
        Conteúdo prático de WMS, em aulas curtas, direto ao ponto.
      </p>

      {erro && (
        <p role="alert" className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {!erro && cards.length === 0 && (
        <p className="mt-6 rounded bg-muted px-4 py-6 text-muted-foreground">
          Nenhum curso à venda neste momento.
        </p>
      )}

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((p) => {
          const curso = p.cursosExpandidos[0]
          return (
            <li key={p.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                {p.capa ? (
                  <img
                    src={`/api/files/produtos/${p.id}/${p.capa}?thumb=800x450`}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="aspect-video w-full bg-muted" aria-hidden />
                )}
                <CardContent className="flex flex-1 flex-col p-4">
                  <h2 className="font-medium leading-snug">{curso?.titulo ?? p.titulo}</h2>
                  {curso?.resumo_1linha && (
                    <p className="mt-1 text-sm text-muted-foreground">{curso.resumo_1linha}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {duracaoBR(curso?.carga_min ? curso.carga_min * 60 : 0)
                      ? `${duracaoBR(curso!.carga_min! * 60)} de vídeo`
                      : 'Carga em definição'}
                  </p>
                  <div className="mt-auto pt-4">
                    <p className="text-lg font-semibold">{precoBR(p.preco_centavos)}</p>
                    <Button asChild className="mt-2 w-full">
                      <Link to={`/ead/${curso?.slug ?? p.slug}`}>
                        {logado ? 'Ver curso' : 'Conhecer'}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// O expand do PocketBase devolve o registro em `expand.cursos`.
function extrairCursos(p: any): Curso[] {
  const e = p?.expand?.cursos
  if (!e) return []
  return Array.isArray(e) ? e : [e]
}
