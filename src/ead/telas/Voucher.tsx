// src/ead/telas/Voucher.tsx → rota /ead/voucher
//
// ONDE O ALUNO DIGITA O CÓDIGO de acesso (funcionário da Zion, prospecção,
// campanha). É a porta de entrada de quem NÃO comprou.
//
// POR QUE UMA TELA SEPARADA E NÃO UM CAMPO NA COMPRA:
// voucher de ACESSO não passa por pagamento — não faz sentido pedir cartão
// para quem tem um código de cortesia. Quem tem código de DESCONTO usa o
// código na tela de compra (lá o servidor abate o valor).
//
// O QUE A TELA NÃO FAZ: não decide se o código vale. Ela manda para o servidor
// e mostra a resposta. Validade, limite de usos, e-mail de destino e curso são
// checados em /backend/v1/voucher/resgatar — se a regra vivesse aqui, qualquer
// um a burlaria pelo console do navegador.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getToken, ErroApi } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Voucher() {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const navigate = useNavigate()
  const logado = !!getToken()

  async function resgatar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')

    const limpo = codigo.trim().toUpperCase()
    if (limpo.length < 4) return setErro('Digite o código completo.')

    setOcupado(true)
    try {
      const r = await api.resgatarVoucher(limpo)
      setSucesso(r.mensagem ?? 'Acesso liberado.')
      // Vai direto para a área do aluno: o acesso já está criado, o próximo
      // passo útil é assistir — não ficar olhando confirmação.
      setTimeout(() => navigate('/ead/minha-area'), 1800)
    } catch (err) {
      if (err instanceof ErroApi) {
        setErro(err.message)
      } else {
        setErro('Não foi possível validar o código agora. Tente de novo.')
      }
    } finally {
      setOcupado(false)
    }
  }

  // Sem login não há a quem dar acesso — a matrícula precisa de um usuário.
  if (!logado) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Tenho um código</h1>
        <p className="mt-3 text-muted-foreground">
          Entre na sua conta para usar o código. Se ainda não tem conta, crie uma em menos de um
          minuto — é só e-mail e senha.
        </p>
        <Button asChild className="mt-6">
          <Link to="/ead/entrar?voltar=/ead/voucher">Entrar ou criar conta</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Tenho um código de acesso</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Digite o código que você recebeu. Se ele libera um curso, o acesso é criado na hora.
      </p>

      <form onSubmit={resgatar} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Ex.: QW7XWSK3"
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-1 font-mono tracking-widest uppercase"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Não importa maiúscula ou minúscula, espaço ou hífen.
          </p>
        </div>

        {erro && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        {sucesso && (
          <p role="status" className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {sucesso}
          </p>
        )}

        <Button type="submit" disabled={ocupado} className="w-full">
          {ocupado ? 'Validando…' : 'Usar código'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/ead" className="underline">
            Ver os cursos
          </Link>
        </p>
      </form>
    </div>
  )
}
