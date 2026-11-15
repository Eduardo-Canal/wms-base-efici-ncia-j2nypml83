// src/ead/telas/Comprar.tsx → rota /ead/comprar?produto=slug
// Formulário mínimo (nome + e-mail) e redireciona para o Checkout Pro do MP.
// O servidor cria o pedido e devolve o link; o VALOR nunca passa por aqui.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, precoBR, type Produto } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Comprar() {
  const [params] = useSearchParams()
  const produtoSlug = params.get('produto') ?? ''
  const [produto, setProduto] = useState<Produto | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    api
      .produtos()
      .then((ps) => setProduto(ps.find((p) => p.slug === produtoSlug) ?? null))
      .catch(() => setProduto(null))
  }, [produtoSlug])

  async function pagar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (nome.trim().length < 2) return setErro('Informe seu nome completo.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setErro('Informe um e-mail válido — é por ele que você entra no curso.')

    setOcupado(true)
    try {
      const r = await api.iniciarCheckout(produtoSlug, nome.trim(), email.trim().toLowerCase())
      // Checkout Pro: sai do site para o ambiente do Mercado Pago.
      window.location.assign(r.link)
    } catch (err: any) {
      setErro(
        err?.codigo === 'pagamento_indisponivel'
          ? 'O pagamento está temporariamente indisponível. Tente em alguns minutos.'
          : err?.codigo === 'ja_matriculado'
            ? 'Você já tem acesso a este curso.'
            : 'Não foi possível iniciar o pagamento. Tente de novo.',
      )
      setOcupado(false)
    }
  }

  if (!produto)
    return <p className="px-4 py-16 text-center text-muted-foreground">Produto não encontrado.</p>

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{produto.titulo}</h1>
      <p className="mt-2 text-lg font-semibold">{precoBR(produto.preco_centavos)}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Você será levado ao Mercado Pago para pagar com cartão. O acesso é liberado automaticamente
        assim que o pagamento é aprovado.
      </p>

      <form onSubmit={pagar} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            É com este e-mail que você entra na área do aluno.
          </p>
        </div>

        {erro && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <Button type="submit" disabled={ocupado} className="w-full" size="lg">
          {ocupado ? 'Abrindo o pagamento…' : 'Ir para o pagamento'}
        </Button>
        <Link to="/ead" className="block text-center text-sm text-muted-foreground underline">
          Voltar
        </Link>
      </form>
    </div>
  )
}
