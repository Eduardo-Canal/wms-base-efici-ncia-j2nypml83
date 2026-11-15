// src/ead/telas/ResetSenha.tsx → rota /reset-password
//
// POR QUE ESTA TELA EXISTE:
// o e-mail de recuperação de senha manda o dono para
// /reset-password?token=... — e essa rota não existia, então o link caía no 404.
// Link de e-mail quebrado é pior que não ter recuperação: a pessoa fica
// trancada fora da própria conta sem saber o que fazer.
//
// COMO FUNCIONA:
// 1. Lê o token da URL (?token=...).
// 2. Pede a nova senha duas vezes (evita erro de digitação que tranca a conta).
// 3. Chama /api/collections/users/confirm-password-reset.
// 4. Em caso de sucesso, manda para /ead/entrar já sabendo que deu certo.
//
// O TOKEN EXPIRA e é de uso único — quem decide isso é o servidor, não a tela.
// Se estiver vencido, a tela diz para pedir outro em vez de mostrar erro técnico.
//
// A rota fica FORA do portão do EAD de propósito: recuperar senha precisa
// funcionar mesmo com a área de cursos fechada. O portão controla CONTEÚDO,
// não acesso à conta.
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ErroApi } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetSenha() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [pronto, setPronto] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')

    setOcupado(true)
    try {
      await api.confirmarNovaSenha(token, senha, confirmacao)
      setPronto(true)
      // Leva para o login depois de um instante, para a pessoa ler a confirmação.
      setTimeout(() => navigate('/ead/entrar'), 2500)
    } catch (err) {
      if (err instanceof ErroApi && err.status === 400) {
        // Token vencido, já usado ou inválido: o servidor não distingue, e a
        // tela também não deve fingir que distingue.
        setErro('Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".')
      } else {
        setErro('Não foi possível salvar a nova senha. Tente de novo.')
      }
    } finally {
      setOcupado(false)
    }
  }

  // Sem token não há o que fazer: o link chegou incompleto.
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Link incompleto</h1>
        <p className="mt-3 text-muted-foreground">
          O endereço não trouxe o código de recuperação. Copie o link inteiro do e-mail ou peça
          outro.
        </p>
        <Button asChild className="mt-6">
          <Link to="/ead/entrar">Ir para o login</Link>
        </Button>
      </div>
    )
  }

  if (pronto) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Senha alterada</h1>
        <p className="mt-3 text-muted-foreground">
          Sua nova senha já vale. Estamos levando você para a tela de entrada…
        </p>
        <Button asChild className="mt-6">
          <Link to="/ead/entrar">Entrar agora</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha uma senha nova para a sua conta.</p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>

        <div>
          <Label htmlFor="confirmacao">Repita a nova senha</Label>
          <Input
            id="confirmacao"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            className="mt-1"
          />
        </div>

        {erro && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <Button type="submit" disabled={ocupado} className="w-full">
          {ocupado ? 'Salvando…' : 'Salvar nova senha'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/ead/entrar" className="underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </div>
  )
}
