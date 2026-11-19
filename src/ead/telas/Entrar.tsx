// Entrar.tsx → /ead/entrar — ITEM 2 DO LOTE 2.
//
// O QUE MUDOU: o aluno NÃO vê mais formulário de senha. O login por senha
// continua existindo para administradores, mas por outra porta (o painel), e
// mostrar a senha aqui convidava o aluno a um caminho que o fluxo dele não usa.
//
// O CARTÃO É O MESMO DO CONVITE (componente `CartaoAcesso`): duas etapas, código
// de 6 dígitos, "Reenviar" com espera de 60 s. Um só lugar para corrigir.
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CartaoAcesso } from '../CartaoAcesso'
import { api, ErroApi } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Entrar() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const voltar = params.get('voltar') || '/ead/minha-area'

  // Modo administrador: escondido por padrão. Quem é admin sabe que existe.
  const [modoAdmin, setModoAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function entrarAdmin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      await api.entrar(email.trim(), senha)
      navegar(voltar, { replace: true })
    } catch (err) {
      setErro(
        err instanceof ErroApi
          ? err.status === 400
            ? 'E-mail ou senha incorretos.'
            : err.message
          : 'Não foi possível entrar agora.',
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sem senha: a gente envia um código de 6 dígitos para o seu e-mail.
      </p>

      <div className="mt-6">
        {modoAdmin ? (
          <form onSubmit={entrarAdmin} className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Acesso administrativo</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="adm-email">E-mail</Label>
                <Input
                  id="adm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="mt-1 h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="adm-senha">Senha</Label>
                <Input
                  id="adm-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 h-11"
                  required
                />
              </div>
            </div>
            {erro && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {erro}
              </p>
            )}
            <Button type="submit" className="mt-4 h-11 w-full" disabled={ocupado}>
              {ocupado ? 'Entrando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setModoAdmin(false)
                setErro('')
              }}
              className="mt-3 min-h-11 w-full text-sm text-muted-foreground underline"
            >
              Entrar com código no e-mail
            </button>
          </form>
        ) : (
          <>
            <CartaoAcesso onEntrou={() => navegar(voltar, { replace: true })} />

            <p className="mt-4 text-center text-sm">
              <Link to="/ead" className="text-muted-foreground underline">
                Ver os cursos
              </Link>
            </p>

            {/* Rota do administrador: discreta, não compete com o aluno. */}
            <p className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setModoAdmin(true)}
                className="min-h-11 text-xs text-muted-foreground underline"
              >
                Sou administrador
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
