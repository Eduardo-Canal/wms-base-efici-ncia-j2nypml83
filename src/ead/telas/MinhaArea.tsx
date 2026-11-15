// src/ead/telas/MinhaArea.tsx → rota /ead/minha-area
// Lista os cursos em que o aluno tem matrícula ATIVA e dá o caminho de volta
// para a primeira aula. A consulta é filtrada pela regra da coleção: cada um
// só enxerga as próprias matrículas.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getToken, type Aula, type Curso, type Modulo } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Linha {
  curso: Curso
  primeiraAula: Aula | null
  total: number
}

export default function MinhaArea({ logado }: { logado: boolean }) {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!logado) {
      setCarregando(false)
      return
    }
    let vivo = true
    ;(async () => {
      try {
        const me = api.sessaoAtual()
        const base = (import.meta.env.VITE_EAD_API_BASE as string | undefined) ?? ''
        const r = await fetch(
          `${base}/api/collections/matriculas/records?perPage=50&filter=${encodeURIComponent(
            `user='${me?.user.id ?? ''}' && status='ativa'`,
          )}&expand=curso`,
          { headers: { Authorization: getToken() } },
        )
        const dados = await r.json()
        const cursos = (dados.items ?? [])
          .map((m: any) => (Array.isArray(m.expand?.curso) ? m.expand.curso[0] : m.expand?.curso))
          .filter(Boolean) as Curso[]

        const prontas: Linha[] = []
        for (const c of cursos) {
          const { modulos, aulas } = await api.estruturaDoCurso(c.id)
          const ids = new Set((modulos as Modulo[]).map((m) => m.id))
          const doCurso = (aulas as Aula[])
            .filter((a) => ids.has(a.modulo))
            .sort((a, b) => a.ordem - b.ordem)
          prontas.push({ curso: c, primeiraAula: doCurso[0] ?? null, total: doCurso.length })
        }
        if (vivo) setLinhas(prontas)
      } catch {
        if (vivo) setLinhas([])
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [logado])

  if (!logado)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Minha área</h1>
        <p className="mt-3 text-muted-foreground">Entre para ver os seus cursos.</p>
        <Button asChild className="mt-6">
          <Link to="/ead/entrar?voltar=/ead/minha-area">Entrar ou criar conta</Link>
        </Button>
      </div>
    )

  if (carregando) return <p className="px-4 py-16 text-center text-muted-foreground">Carregando…</p>

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus cursos</h1>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={() => {
            api.sair()
            navigate('/ead')
          }}
        >
          Sair
        </button>
      </div>

      {linhas.length === 0 && (
        <div className="mt-8 rounded-lg bg-muted p-6">
          <p className="text-muted-foreground">Você ainda não tem nenhum curso.</p>
          <Button asChild className="mt-4">
            <Link to="/ead">Ver os cursos</Link>
          </Button>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {linhas.map((l) => (
          <li key={l.curso.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="font-medium">{l.curso.titulo}</h2>
                  <p className="text-sm text-muted-foreground">{l.total} aulas</p>
                </div>
                {l.primeiraAula ? (
                  <Button asChild>
                    <Link to={`/ead/aula/${l.primeiraAula.slug}`}>Continuar</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link to={`/ead/${l.curso.slug}`}>Ver o curso</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
