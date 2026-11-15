// src/ead/telas/Entrar.tsx → rota /ead/entrar
// Cadastro e login na mesma tela, por aba.
//  * erro de login é genérico: dizer "e-mail não existe" entrega quem é cliente.
//  * recuperação de senha responde IGUAL exista ou não a conta.
//  * o cadastro não envia `papel`: o servidor força "aluno".
// Aviso honesto: confirmação por e-mail depende de remetente verificado, que
// ainda não existe. A tela diz isso em vez de fingir que enviou.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ErroApi } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Aba = 'entrar' | 'criar'

export default function Entrar({ onEntrou }: { onEntrou?: () => void }) {
  const [aba, setAba] = useState<Aba>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setAviso('')
    if (aba === 'criar' && nome.trim().length < 2) return setErro('Informe seu nome.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErro('Informe um e-mail válido.')
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')

    setOcupado(true)
    try {
      if (aba === 'criar') {
        await api.cadastrar(nome.trim(), email.trim().toLowerCase(), senha)
        await api.entrar(email.trim().toLowerCase(), senha)
        setAviso('Conta criada.')
      } else {
        await api.entrar(email.trim().toLowerCase(), senha)
      }
      onEntrou?.()
      const voltar = params.get('voltar')
      navigate(voltar && voltar.startsWith('/') ? voltar : '/ead/minha-area')
    } catch (err) {
      if (err instanceof ErroApi) {
        setErro(
          aba === 'criar'
            ? err.status === 400
              ? 'Já existe conta com este e-mail. Entre ou recupere a senha.'
              : 'Não foi possível criar a conta. Tente de novo.'
            : 'E-mail ou senha não conferem.',
        )
      } else {
        setErro('Falha de conexão. Tente de novo.')
      }
    } finally {
      setOcupado(false)
    }
  }

  async function recuperar() {
    setErro('')
    if (!email) return setErro('Digite seu e-mail para receber o link.')
    try {
      await api.recuperarSenha(email.trim().toLowerCase())
    } catch {
      /* silêncio proposital: mesma resposta com ou sem conta */
    }
    setAviso('Se este e-mail tiver conta, o link de recuperação chega em instantes.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{aba === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Área de cursos do livro.</p>

      <div className="mt-6 flex gap-2 border-b">
        {(['entrar', 'criar'] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => {
              setAba(a)
              setErro('')
              setAviso('')
            }}
            className={`px-3 py-2 text-sm ${
              aba === a ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            {a === 'entrar' ? 'Já tenho conta' : 'Criar conta'}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        {aba === 'criar' && (
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              className="mt-1"
            />
          </div>
        )}
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
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={aba === 'criar' ? 'new-password' : 'current-password'}
            className="mt-1"
          />
          {aba === 'criar' && (
            <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          )}
        </div>

        {erro && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {aviso}
          </p>
        )}

        <Button type="submit" disabled={ocupado} className="w-full">
          {ocupado ? 'Aguarde…' : aba === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
        </Button>

        {aba === 'entrar' && (
          <button
            type="button"
            onClick={recuperar}
            className="w-full text-sm text-muted-foreground underline"
          >
            Esqueci minha senha
          </button>
        )}
      </form>
    </div>
  )
}
