// src/ead/telas/Admin.tsx → rota /ead/admin
//
// PAINEL DO ADMINISTRADOR. É onde o dono:
//   1. liga/desliga a área para o público (o portão)
//   2. edita os textos da área
//   3. libera o acesso de um aluno, depois de conferir o pagamento no MP
//   4. vê quem tem acesso
//
// POR QUE ESTA TELA EXISTE:
// o link de pagamento do Mercado Pago é estático — não avisa o sistema quem
// pagou. O fluxo real é: aluno paga → dono confere no painel do MP → libera aqui
// pelo e-mail. Sem esta tela ele não vende.
//
// SEGURANÇA: a tela esconde por conveniência; quem barra é o servidor. Todo
// endpoint /backend/v1/admin/* responde 403 para quem não é admin. Se alguém
// abrir /ead/admin na mão, vê os campos e recebe erro em cada ação.
//
// NADA DE SEGREDO AQUI: este arquivo vai para o navegador.
import { useEffect, useState } from 'react'
import { api, type AlunoMatricula, type Config, type ProdutoAdmin } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

function mensagemDe(e: unknown): string {
  const x = e as { status?: number; codigo?: string; message?: string }
  if (x?.status === 401) return 'Entre com uma conta de administrador.'
  if (x?.status === 403) return 'Esta conta não é administradora.'
  if (x?.status === 404) return 'Não encontrado.'
  return x?.message || 'Não foi possível completar a ação.'
}

export default function Admin() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function carregarConfig() {
    setCarregando(true)
    api
      .adminConfig()
      .then(setCfg)
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setCarregando(false))
  }

  useEffect(carregarConfig, [])

  async function salvar(patch: Partial<Config>) {
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const r = await api.adminSalvarConfig(patch)
      setAviso(r.mensagem ?? 'Salvo.')
      // Relê do servidor: mostra o estado real, não o otimista.
      const atual = await api.adminConfig()
      setCfg(atual)
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="px-4 py-16 text-center text-muted-foreground">Carregando…</p>

  if (erro && !cfg)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Administração do EAD</h1>
          <button
            className="text-sm text-muted-foreground underline"
            onClick={() => {
              api.sair()
              window.location.href = '/ead'
            }}
          >
            Sair
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <a href="/ead" className="underline">
            ← Voltar para os cursos
          </a>
        </p>
        <p className="mt-3 text-destructive">{erro}</p>
      </div>
    )

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Administração do EAD</h1>

      {/* O controle mais importante da tela: decide se o público vê a área. */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Liberação para o público</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md text-sm text-muted-foreground">
            {cfg?.liberado
              ? 'A área está ABERTA: qualquer visitante vê o catálogo e pode comprar.'
              : 'A área está FECHADA: só administradores veem. É o modo de teste.'}
          </p>
          <Button
            variant={cfg?.liberado ? 'destructive' : 'default'}
            disabled={salvando}
            onClick={() => salvar({ liberado: !cfg?.liberado })}
          >
            {salvando
              ? 'Salvando…'
              : cfg?.liberado
                ? 'Fechar para o público'
                : 'Liberar para o público'}
          </Button>
        </CardContent>
      </Card>

      {aviso && (
        <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</p>
      )}
      {erro && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <div className="mt-8 grid gap-6">
        <Campo
          rotulo="Título da área"
          dica="Aparece no topo da página de cursos."
          valor={cfg?.titulo_area ?? ''}
          onSalvar={(v) => salvar({ titulo_area: v })}
          salvando={salvando}
        />
        <Campo
          rotulo="Aviso de rascunho"
          dica="Texto que só o administrador vê enquanto a área está fechada."
          valor={cfg?.aviso_rascunho ?? ''}
          onSalvar={(v) => salvar({ aviso_rascunho: v })}
          salvando={salvando}
          multilinha
        />
        <Campo
          rotulo="Instruções para quem comprou"
          dica="Mostrado ao aluno na área dele. Ex.: envie o comprovante para ..."
          valor={cfg?.instrucoes_compra ?? ''}
          onSalvar={(v) => salvar({ instrucoes_compra: v })}
          salvando={salvando}
          multilinha
        />
        <Campo
          rotulo="E-mail de suporte"
          dica="Para onde o aluno escreve se algo der errado."
          valor={cfg?.email_suporte ?? ''}
          onSalvar={(v) => salvar({ email_suporte: v })}
          salvando={salvando}
        />
      </div>

      <Produtos />

      <Alunos />
    </div>
  )
}

// Preço e link de pagamento — o que o dono pediu para editar sozinho.
function Produtos() {
  const [lista, setLista] = useState<ProdutoAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  function carregar() {
    setCarregando(true)
    api
      .adminProdutos()
      .then((r) => setLista(r.produtos))
      .catch((e) => setErro(mensagemDe(e)))
      .finally(() => setCarregando(false))
  }
  useEffect(carregar, [])

  return (
    <div className="mt-10">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preço e link de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O aluno clica em Comprar e vai para o seu link do Mercado Pago. Depois de conferir o
            pagamento, libere o acesso em “Liberar acesso”.
          </p>

          {msg && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {msg}
            </p>
          )}
          {erro && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}

          {carregando ? (
            <p className="py-4 text-sm text-muted-foreground">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {lista.map((p) => (
                <ProdutoLinha
                  key={p.id}
                  produto={p}
                  onSalvo={(m) => {
                    setMsg(m)
                    setErro('')
                    carregar()
                  }}
                  onErro={(m) => {
                    setErro(m)
                    setMsg('')
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProdutoLinha({
  produto,
  onSalvo,
  onErro,
}: {
  produto: ProdutoAdmin
  onSalvo: (m: string) => void
  onErro: (m: string) => void
}) {
  // Preço em reais para digitar; o banco guarda centavos.
  const [preco, setPreco] = useState(
    produto.preco_centavos > 0 ? (produto.preco_centavos / 100).toFixed(2).replace('.', ',') : '',
  )
  const [link, setLink] = useState(produto.mp_link ?? '')
  const [ativo, setAtivo] = useState(produto.ativo)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const r = await api.adminSalvarProduto({
        id: produto.id,
        preco_reais: preco,
        mp_link: link,
        ativo,
      })
      onSalvo(r.mensagem ?? 'Salvo.')
    } catch (e) {
      onErro(mensagemDe(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{produto.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {produto.curso_titulo || produto.curso_slug || 'sem curso'} · slug {produto.slug}
          </p>
        </div>
        <Badge variant={ativo ? 'default' : 'secondary'}>{ativo ? 'à venda' : 'pausado'}</Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Preço (R$)</Label>
          <Input
            className="mt-1"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="197,00"
            inputMode="decimal"
          />
        </div>
        <div>
          <Label className="text-xs">Link de pagamento (Mercado Pago)</Label>
          <Input
            className="mt-1"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://mpago.la/..."
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Colocar à venda
        </label>
        <Button disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

function Campo({
  rotulo,
  dica,
  valor,
  onSalvar,
  salvando,
  multilinha,
}: {
  rotulo: string
  dica?: string
  valor: string
  onSalvar: (v: string) => void
  salvando: boolean
  multilinha?: boolean
}) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor])
  const mudou = v !== valor

  return (
    <div>
      <Label className="text-sm font-medium">{rotulo}</Label>
      {dica && <p className="mt-0.5 text-xs text-muted-foreground">{dica}</p>}
      <div className="mt-2 flex gap-2">
        {multilinha ? (
          <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={3} />
        ) : (
          <Input value={v} onChange={(e) => setV(e.target.value)} />
        )}
        <Button variant="secondary" disabled={!mudou || salvando} onClick={() => onSalvar(v)}>
          Salvar
        </Button>
      </div>
    </div>
  )
}

// Liberar e revogar acesso — o coração do fluxo manual.
function Alunos() {
  const [alunos, setAlunos] = useState<AlunoMatricula[]>([])
  const [carregando, setCarregando] = useState(true)
  const [email, setEmail] = useState('')
  const [curso, setCurso] = useState('')
  const [dias, setDias] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  function carregar() {
    setCarregando(true)
    api
      .adminAlunos()
      .then((r) => setAlunos(r.alunos))
      .catch(() => setErro('Não foi possível carregar a lista.'))
      .finally(() => setCarregando(false))
  }
  useEffect(carregar, [])

  async function liberar() {
    setErro('')
    setMsg('')
    try {
      const r = await api.adminLiberar({
        email,
        curso_slug: curso,
        dias: dias ? Number(dias) : 0,
      })
      setMsg(r.mensagem ?? 'Acesso liberado.')
      setEmail('')
      carregar()
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  async function revogar(emailAluno: string, cursoSlug: string) {
    setErro('')
    setMsg('')
    try {
      await api.adminRevogar({ email: emailAluno, curso_slug: cursoSlug })
      setMsg('Acesso revogado.')
      carregar()
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Liberar acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Confira o pagamento no painel do Mercado Pago e libere pelo e-mail do aluno. O aluno
            precisa já ter conta em /ead/entrar.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">E-mail do aluno</Label>
              <Input
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aluno@exemplo.com"
              />
            </div>
            <div>
              <Label className="text-xs">Slug do curso</Label>
              <Input
                className="mt-1"
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                placeholder="fund-wms-fundamentos"
              />
            </div>
            <div>
              <Label className="text-xs">Dias (vazio = sem prazo)</Label>
              <Input
                className="mt-1"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <Button className="mt-4" disabled={!email || !curso} onClick={liberar}>
            Liberar acesso
          </Button>
          {msg && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {msg}
            </p>
          )}
          {erro && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quem tem acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="py-4 text-sm text-muted-foreground">Carregando…</p>
          ) : alunos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Ninguém tem acesso ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {alunos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.nome || '—'}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </TableCell>
                    <TableCell>{a.curso_titulo || a.curso_slug}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'ativa' ? 'default' : 'secondary'}>
                        {a.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.expira_em ? a.expira_em.slice(0, 10) : 'sem prazo'}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === 'ativa' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => revogar(a.email, a.curso_slug)}
                        >
                          Revogar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
