// CertificadoAdmin.tsx — configuração do certificado (no CURSO) e capítulos.
//
// DECISÕES DO DONO (16/11, 16:00):
//   * certificado é POR CURSO (ele corrigiu o pedido inicial, que era por módulo);
//   * a assinatura era para ser cadastrada no módulo, mas com certificado por
//     curso isso ficaria repetido em 6+ módulos e mudaria em 6+ lugares no dia
//     em que o cargo mudar. Aqui a assinatura vive no curso, preenchida uma vez.
//
// O QUE A TELA NÃO DEIXA FAZER: ativar o certificado sem carga horária ou sem
// assinante. Um PDF sem esses dois dados não vale nada, e é melhor barrar aqui
// do que emitir papel inválido para o aluno descobrir depois.
import { useEffect, useState } from 'react'
import { api, type CursoConteudo } from '../api'
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

export default function CertificadoAdmin() {
  const [cursos, setCursos] = useState<CursoConteudo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  function carregar() {
    setCarregando(true)
    api
      .adminConteudo()
      .then((r) => setCursos(r.cursos))
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setCarregando(false))
  }

  useEffect(carregar, [])

  function aviso(t: string, erro = false) {
    setMsg(erro ? '' : t)
    setErro(erro ? t : '')
    setTimeout(() => {
      setMsg('')
      setErro('')
    }, 7000)
  }

  if (carregando) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>

  return (
    <div className="mt-10">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Certificado e capítulos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O certificado é <strong>do curso</strong> — sai quando o aluno conclui todas as aulas
            publicadas. A assinatura fica aqui, preenchida uma vez.
          </p>

          {msg && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {msg}
            </p>
          )}
          {erro && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}

          {cursos.map((c) => (
            <BlocoCurso key={c.id} curso={c} aoSalvar={carregar} aviso={aviso} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function BlocoCurso({
  curso,
  aoSalvar,
  aviso,
}: {
  curso: CursoConteudo
  aoSalvar: () => void
  aviso: (t: string, erro?: boolean) => void
}) {
  const [ativo, setAtivo] = useState(curso.cert_ativo)
  const [titulo, setTitulo] = useState(curso.cert_titulo ?? '')
  const [texto, setTexto] = useState(curso.cert_texto ?? '')
  const [carga, setCarga] = useState(curso.cert_carga_horas ? String(curso.cert_carga_horas) : '')
  const [assinante, setAssinante] = useState(curso.cert_assinante_nome ?? '')
  const [cargo, setCargo] = useState(curso.cert_assinante_cargo ?? '')
  const [cidade, setCidade] = useState(curso.cert_cidade ?? '')
  const [ocupado, setOcupado] = useState(false)

  // Capítulo novo
  const [novaParte, setNovaParte] = useState('')

  async function salvar() {
    setOcupado(true)
    try {
      const r = await api.adminSalvarCertificado({
        curso_slug: curso.slug,
        cert_ativo: ativo,
        cert_titulo: titulo,
        cert_texto: texto,
        cert_carga_horas: Number(carga) || 0,
        cert_assinante_nome: assinante,
        cert_assinante_cargo: cargo,
        cert_cidade: cidade,
      })
      aviso(r.mensagem ?? 'Salvo.')
      aoSalvar()
    } catch (e) {
      aviso(mensagemDe(e), true)
    } finally {
      setOcupado(false)
    }
  }

  async function criarParte() {
    if (novaParte.trim().length < 2) return
    setOcupado(true)
    try {
      const r = await api.adminSalvarParte({ curso_slug: curso.slug, titulo: novaParte.trim() })
      aviso(r.mensagem ?? 'Capítulo criado.')
      setNovaParte('')
      aoSalvar()
    } catch (e) {
      aviso(mensagemDe(e), true)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{curso.titulo}</p>
          <p className="text-xs text-muted-foreground font-mono">{curso.slug}</p>
        </div>
        <Badge variant={curso.cert_ativo ? 'default' : 'secondary'}>
          {curso.cert_ativo ? 'certificado ativo' : 'certificado desligado'}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">Título do certificado</Label>
          <Input
            className="mt-1"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Certificado de Conclusão — WMS: Fundamentos e Integrações"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Texto do certificado (opcional)</Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Certificamos que o aluno concluiu o curso, com a carga horária abaixo."
          />
        </div>
        <div>
          <Label className="text-xs">Carga horária (horas)</Label>
          <Input
            className="mt-1"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            inputMode="numeric"
            placeholder="18"
          />
        </div>
        <div>
          <Label className="text-xs">Cidade da emissão</Label>
          <Input
            className="mt-1"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="São Paulo"
          />
        </div>
        <div>
          <Label className="text-xs">Quem assina (nome)</Label>
          <Input
            className="mt-1"
            value={assinante}
            onChange={(e) => setAssinante(e.target.value)}
            placeholder="Eduardo Canal"
          />
        </div>
        <div>
          <Label className="text-xs">Cargo de quem assina</Label>
          <Input
            className="mt-1"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Autor e Especialista em WMS"
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Certificado ativo para este curso
      </label>
      {ativo && (!carga || !assinante) && (
        <p className="mt-1 text-xs text-amber-700">
          Para ativar é preciso informar a carga horária e quem assina — o servidor recusa sem isso.
        </p>
      )}

      <Button className="mt-3" disabled={ocupado} onClick={salvar}>
        {ocupado ? 'Salvando…' : 'Salvar certificado'}
      </Button>

      {/* ---- capítulos ---- */}
      <div className="mt-6 border-t pt-4">
        <p className="text-sm font-medium">Capítulos</p>
        <p className="text-xs text-muted-foreground">
          Cada capítulo do livro agrupa módulos. Módulo sem capítulo aparece como &quot;sem
          capítulo&quot;.
        </p>

        {curso.partes?.length > 0 && (
          <ul className="mt-3 space-y-1">
            {curso.partes.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Badge variant={p.publicado ? 'default' : 'secondary'} className="text-xs">
                  {p.rotulo || `Capítulo ${p.ordem}`}
                </Badge>
                <span>{p.titulo}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs">Novo capítulo</Label>
            <Input
              className="mt-1"
              value={novaParte}
              onChange={(e) => setNovaParte(e.target.value)}
              placeholder="Ex.: Logística in house na prática"
              onKeyDown={(e) => e.key === 'Enter' && criarParte()}
            />
          </div>
          <Button
            variant="outline"
            disabled={ocupado || novaParte.trim().length < 2}
            onClick={criarParte}
          >
            Adicionar capítulo
          </Button>
        </div>
      </div>
    </div>
  )
}
