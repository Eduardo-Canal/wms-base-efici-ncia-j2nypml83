// Conteudo.tsx — a tela que faltava: montar o curso (módulos e aulas).
//
// O QUE O DONO PEDIU (16/11, 15:40): "um lugar de configuração do curso, de
// poder subir as aulas com o link, com nome e descrição da aula".
//
// POR QUE ISSO NÃO EXISTIA: os campos estavam todos no banco e as telas de
// aluno funcionavam — mas não havia como PREENCHER. O curso só nascia por
// migration. A estrutura estava pronta e inacessível.
//
// DECISÕES DESTA TELA:
//   * O campo de vídeo aceita o LINK COLADO do Bunny, não exige o id.
//   * Publicar desabilita se não houver vídeo — avisa ANTES de salvar, em vez
//     de devolver erro depois.
//   * Slug e ordem NÃO aparecem para digitar: são gerados pelo servidor.
//   * Aula com aluno que já assistiu não tem "excluir" — apagar levaria o
//     progresso de quem estudou.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AulaConteudo, type CursoConteudo, type ModuloConteudo } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

function mensagemDe(e: unknown): string {
  const x = e as { message?: string }
  return x?.message || 'Não foi possível completar a ação.'
}

export default function Conteudo() {
  const [cursos, setCursos] = useState<CursoConteudo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [cursoAberto, setCursoAberto] = useState('')

  function carregar() {
    setCarregando(true)
    api
      .adminConteudo()
      .then((r) => {
        setCursos(r.cursos)
        if (!cursoAberto && r.cursos.length) setCursoAberto(r.cursos[0].slug)
      })
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setCarregando(false))
  }

  useEffect(carregar, [])

  function aviso(texto: string) {
    setMsg(texto)
    setErro('')
    setTimeout(() => setMsg(''), 6000)
  }

  if (carregando) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>

  return (
    <div className="mt-10">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conteúdo do curso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Monte os módulos e as aulas. O vídeo é o <strong>link do Bunny</strong> — cole o
            endereço de incorporação e o sistema extrai o que precisa.
          </p>

          {msg && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {msg}
            </p>
          )}
          {erro && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}

          {cursos.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Nenhum curso encontrado.</p>
          ) : (
            cursos.map((c) => (
              <div key={c.id} className="mt-6 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setCursoAberto(cursoAberto === c.slug ? '' : c.slug)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.modulos.length} módulo(s) ·{' '}
                      {c.modulos.reduce((n, m) => n + m.aulas.length, 0)} aula(s) ·{' '}
                      <span className="font-mono">{c.slug}</span>
                    </p>
                  </div>
                  <Badge variant={c.publicado ? 'default' : 'secondary'}>
                    {c.publicado ? 'publicado' : 'rascunho'}
                  </Badge>
                </button>

                {cursoAberto === c.slug && (
                  <div className="border-t px-4 py-4">
                    <NovoModulo cursoSlug={c.slug} aoSalvar={carregar} aviso={aviso} />

                    {c.modulos.length === 0 && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Nenhum módulo ainda. Comece criando o primeiro acima.
                      </p>
                    )}

                    {c.modulos.map((m) => (
                      <Modulo
                        key={m.id}
                        modulo={m}
                        cursoSlug={c.slug}
                        numeroModulo={m.ordem}
                        aoSalvar={carregar}
                        aviso={aviso}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NovoModulo({
  cursoSlug,
  aoSalvar,
  aviso,
}: {
  cursoSlug: string
  aoSalvar: () => void
  aviso: (t: string) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function criar() {
    if (titulo.trim().length < 2) return
    setOcupado(true)
    try {
      const r = await api.adminSalvarModulo({ curso_slug: cursoSlug, titulo: titulo.trim() })
      aviso(r.mensagem ?? 'Módulo criado.')
      setTitulo('')
      aoSalvar()
    } catch (e) {
      aviso(mensagemDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1">
        <Label className="text-xs">Novo módulo</Label>
        <Input
          className="mt-1"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Fundamentos da logística in-house"
          onKeyDown={(e) => e.key === 'Enter' && criar()}
        />
      </div>
      <Button disabled={ocupado || titulo.trim().length < 2} onClick={criar}>
        {ocupado ? 'Criando…' : 'Adicionar módulo'}
      </Button>
    </div>
  )
}

function Modulo({
  modulo,
  cursoSlug,
  numeroModulo,
  aoSalvar,
  aviso,
}: {
  modulo: ModuloConteudo
  cursoSlug: string
  numeroModulo: number
  aoSalvar: () => void
  aviso: (t: string) => void
}) {
  const [abrindo, setAbrindo] = useState(false)

  return (
    <div className="mt-5 rounded-md bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            Módulo {numeroModulo} · {modulo.titulo}
          </p>
          <p className="text-xs text-muted-foreground">
            {modulo.aulas.length} aula(s) · <span className="font-mono">{modulo.slug}</span>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAbrindo(!abrindo)}>
          {abrindo ? 'Fechar' : 'Adicionar aula'}
        </Button>
      </div>

      {abrindo && (
        <FormAula
          moduloId={modulo.id}
          proximaOrdem={modulo.aulas.length + 1}
          numeroModulo={numeroModulo}
          aoSalvar={() => {
            aoSalvar()
            setAbrindo(false)
          }}
          aviso={aviso}
        />
      )}

      <div className="mt-3 space-y-2">
        {modulo.aulas.map((a) => (
          <LinhaAula
            key={a.id}
            aula={a}
            numeroModulo={numeroModulo}
            aoSalvar={aoSalvar}
            aviso={aviso}
          />
        ))}
        {modulo.aulas.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma aula neste módulo.</p>
        )}
      </div>
    </div>
  )
}

function LinhaAula({
  aula,
  numeroModulo,
  aoSalvar,
  aviso,
}: {
  aula: AulaConteudo
  numeroModulo: number
  aoSalvar: () => void
  aviso: (t: string) => void
}) {
  const [editando, setEditando] = useState(false)

  return (
    <div className="rounded border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-mono text-xs text-muted-foreground">{aula.numero}</span>{' '}
            <span className="font-medium">{aula.titulo}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={aula.publicado ? 'default' : 'secondary'} className="text-xs">
              {aula.publicado ? 'publicada' : 'rascunho'}
            </Badge>
            {aula.video_pronto ? (
              <span className="text-xs text-emerald-700">vídeo ok</span>
            ) : (
              <span className="text-xs text-amber-700">sem vídeo</span>
            )}
            {aula.amostra && <span className="text-xs text-blue-700">aula-isca</span>}
            {aula.duracao_seg > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(aula.duracao_seg / 60)} min
              </span>
            )}
            {aula.tem_aluno && <span className="text-xs text-muted-foreground">já tem aluno</span>}
          </div>
          {aula.descricao && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{aula.descricao}</p>
          )}
        </div>
        <div className="flex gap-2">
          {aula.publicado && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/ead/aula/${aula.slug}`} target="_blank">
                Ver
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditando(!editando)}>
            {editando ? 'Fechar' : 'Editar'}
          </Button>
        </div>
      </div>

      {editando && (
        <FormAula
          aula={aula}
          moduloId=""
          proximaOrdem={aula.ordem}
          numeroModulo={numeroModulo}
          aoSalvar={() => {
            aoSalvar()
            setEditando(false)
          }}
          aviso={aviso}
          aoExcluir={() => {
            aoSalvar()
            setEditando(false)
          }}
        />
      )}
    </div>
  )
}

function FormAula({
  aula,
  moduloId,
  proximaOrdem,
  numeroModulo,
  aoSalvar,
  aviso,
  aoExcluir,
}: {
  aula?: AulaConteudo
  moduloId: string
  proximaOrdem: number
  numeroModulo: number
  aoSalvar: () => void
  aviso: (t: string) => void
  aoExcluir?: () => void
}) {
  const [titulo, setTitulo] = useState(aula?.titulo ?? '')
  const [descricao, setDescricao] = useState(aula?.descricao ?? '')
  const [numero, setNumero] = useState(aula?.numero ?? '')
  const [videoUrl, setVideoUrl] = useState(aula?.video_id ?? '')
  const [materialUrl, setMaterialUrl] = useState(aula?.material_url ?? '')
  const [pergunta, setPergunta] = useState(aula?.pergunta_fixacao ?? '')
  const [duracao, setDuracao] = useState(
    aula?.duracao_seg ? String(Math.round(aula.duracao_seg / 60)) : '',
  )
  const [publicado, setPublicado] = useState(aula?.publicado ?? false)
  const [amostra, setAmostra] = useState(aula?.amostra ?? false)
  const [ocupado, setOcupado] = useState(false)

  // Publicar exige vídeo: aviso ANTES de salvar, não erro depois.
  const temVideo = videoUrl.trim().length > 0
  const travarPublicar = !temVideo

  async function salvar() {
    if (titulo.trim().length < 2) return aviso('Dê um nome à aula.')
    setOcupado(true)
    try {
      const r = await api.adminSalvarAula({
        id: aula?.id,
        modulo_id: aula ? undefined : moduloId,
        titulo: titulo.trim(),
        descricao,
        numero: numero.trim() || undefined,
        video_url: videoUrl.trim() || undefined,
        material_url: materialUrl.trim() || undefined,
        pergunta_fixacao: pergunta,
        duracao_min: Number(duracao) || 0,
        publicado,
        amostra,
        ordem: aula ? aula.ordem : proximaOrdem,
      })
      aviso(r.mensagem ?? 'Aula salva.')
      aoSalvar()
    } catch (e) {
      aviso(mensagemDe(e))
    } finally {
      setOcupado(false)
    }
  }

  async function excluir() {
    if (!aula) return
    setOcupado(true)
    try {
      const r = await api.adminExcluirAula(aula.id)
      aviso(r.mensagem ?? 'Aula excluída.')
      aoExcluir?.()
    } catch (e) {
      aviso(mensagemDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-3 rounded border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">Nome da aula</Label>
          <Input
            className="mt-1"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: O que é um WMS e por que ele falha"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Descrição da aula</Label>
          <Textarea
            className="mt-1"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que o aluno aprende nesta aula."
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Link do vídeo (Bunny)</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://iframe.mediadelivery.net/embed/12345/abc-123..."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cole o link de incorporação do Bunny ou só o id do vídeo.
          </p>
        </div>
        <div>
          <Label className="text-xs">Número falado na aula (opcional)</Label>
          <Input
            className="mt-1"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder={`M${numeroModulo}.${proximaOrdem}`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Em branco, o sistema usa M{numeroModulo}.{proximaOrdem}.
          </p>
        </div>
        <div>
          <Label className="text-xs">Duração (minutos)</Label>
          <Input
            className="mt-1"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            inputMode="numeric"
            placeholder="12"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Link do PDF de apoio (opcional)</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={materialUrl}
            onChange={(e) => setMaterialUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Pergunta de fixação (opcional)</Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Pergunta que faz o aluno pensar antes da próxima aula."
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publicado}
            disabled={travarPublicar}
            onChange={(e) => setPublicado(e.target.checked)}
          />
          Publicada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={amostra} onChange={(e) => setAmostra(e.target.checked)} />
          Aberta como isca (sem login)
        </label>
      </div>
      {travarPublicar && (
        <p className="mt-1 text-xs text-amber-700">
          Para publicar é preciso ter o link do vídeo — sem ele o aluno cairia em "aula em
          produção".
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={ocupado} onClick={salvar}>
          {ocupado ? 'Salvando…' : aula ? 'Salvar alterações' : 'Adicionar aula'}
        </Button>
        {aula &&
          (aula.tem_aluno ? (
            <Button variant="outline" disabled title="Tem aluno: despublicar em vez de excluir">
              Despublicar em vez de excluir
            </Button>
          ) : (
            <Button variant="outline" disabled={ocupado} onClick={excluir}>
              Excluir aula
            </Button>
          ))}
      </div>
    </div>
  )
}
