// src/ead/telas/MinhaArea.tsx → rota /ead/minha-area
// Lista os cursos em que o aluno tem matrícula ATIVA e dá o caminho de volta
// para a PRÓXIMA aula (não a primeira: voltar sempre ao início é o que faz o
// aluno desistir no meio). A consulta é filtrada pela regra da coleção: cada um
// só enxerga as próprias matrículas.
//
// MUDANÇA 16/11 (item 1 da ordem aprovada): o cartão passa a mostrar o
// PROGRESSO — "4 de 20 aulas · 20%". Antes existia só "20 aulas", que não diz
// nada a quem já começou.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getToken, type Aula, type Curso, type Modulo, type ProgressoCurso } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Linha {
  curso: Curso
  proximaAula: Aula | null
  total: number
  progresso: ProgressoCurso | null
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

          // Progresso vem do servidor (fonte única). Se falhar, a tela ainda
          // mostra o curso — só sem o número.
          let progresso: ProgressoCurso | null = null
          try {
            progresso = await api.progressoCurso(c.slug)
          } catch {
            progresso = null
          }

          // Próxima aula = primeira que o aluno ainda NÃO concluiu.
          const feitas = new Set(
            (progresso?.aulas ?? []).filter((a) => a.concluida).map((a) => a.slug),
          )
          const proxima = doCurso.find((a) => !feitas.has(a.slug)) ?? null

          prontas.push({
            curso: c,
            proximaAula: proxima,
            total: doCurso.length,
            progresso,
          })
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
        {linhas.map((l) => {
          const p = l.progresso
          const pct = p?.percentual ?? 0
          const concluidas = p?.concluidas ?? 0
          const totalPub = p?.total ?? l.total
          const completo = totalPub > 0 && concluidas === totalPub

          return (
            <li key={l.curso.id}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-medium">{l.curso.titulo}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {totalPub} {totalPub === 1 ? 'aula' : 'aulas'}
                        {p && (
                          <>
                            {' · '}
                            <span className="font-medium text-foreground">
                              {concluidas} de {totalPub} concluídas
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {completo ? (
                      p?.certificado ? (
                        <Badge variant="default">Certificado emitido</Badge>
                      ) : p?.pode_certificar ? (
                        <Badge variant="secondary">Curso concluído</Badge>
                      ) : (
                        <Badge variant="secondary">Concluído</Badge>
                      )
                    ) : l.proximaAula ? (
                      <Button asChild>
                        <Link to={`/ead/aula/${l.proximaAula.slug}`}>
                          {concluidas > 0 ? 'Continuar' : 'Começar'}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <Link to={`/ead/${l.curso.slug}`}>Ver o curso</Link>
                      </Button>
                    )}
                  </div>

                  {/* Barra de progresso: só aparece quando há o que medir. */}
                  {p && totalPub > 0 && (
                    <div className="mt-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pct}% concluído</p>
                    </div>
                  )}

                  {completo && p?.pode_certificar && !p.certificado && (
                    <div className="mt-4">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/ead/${l.curso.slug}#certificado`}>Emitir meu certificado</Link>
                      </Button>
                    </div>
                  )}

                  {p?.certificado && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Certificado <span className="font-mono">{p.certificado.codigo}</span> ·{' '}
                      <Link
                        to={`/certificado/${p.certificado.codigo}`}
                        className="underline"
                        target="_blank"
                      >
                        verificar
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
