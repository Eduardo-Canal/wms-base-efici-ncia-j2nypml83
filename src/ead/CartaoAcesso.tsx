// CartaoAcesso.tsx — entrada em duas etapas, reutilizada pelo Convite e por
// /ead/entrar.
//
// POR QUE UM COMPONENTE SÓ: o convite e a tela de entrar mostram o MESMO cartão
// (o pedido é explícito nos itens 1 e 2). Duplicar significaria corrigir o mesmo
// bug duas vezes — e o bug aqui é de autenticação.
//
// POR QUE NÃO TEM SENHA: o login por senha ficou só para administradores. O
// aluno entra por código no e-mail. Mostrar campo de senha para aluno é oferecer
// um caminho que o servidor não aceita.
//
// ACESSIBILIDADE:
//  - todo campo tem <label> ligado por htmlFor/id;
//  - erro em texto (role="alert"), nunca só cor;
//  - foco visível herdado do shadcn;
//  - input do código com inputmode="numeric" e autocomplete="one-time-code"
//    (o teclado numérico abre no celular e o iOS sugere o código do SMS/e-mail);
//  - alvos de toque ≥44 px (h-11).
//
// MOBILE PRIMEIRO: a largura é fluida, sem largura fixa; em 390 px o cartão
// ocupa a coluna toda.
import { useEffect, useRef, useState } from 'react'
// Este arquivo está em src/ead/, então o api.ts é vizinho, não pai.
import { apiLote2, ErroApi, authWithCodigo } from './api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Etapa = 'dados' | 'codigo'

export function CartaoAcesso({
  nomeInicial = '',
  emailInicial = '',
  emailTravado = false,
  codigoConvite = '',
  onEntrou,
  tituloBotao = 'Receber código no e-mail',
}: {
  nomeInicial?: string
  emailInicial?: string
  emailTravado?: boolean
  // Código do convite, quando a entrada vem da página /presente/:codigo.
  // O mockup mostra o campo preenchido com ✔ — é o que dá segurança de que a
  // pessoa está no convite certo.
  codigoConvite?: string
  onEntrou: () => void | Promise<void>
  tituloBotao?: string
}) {
  const [etapa, setEtapa] = useState<Etapa>('dados')
  const [nome, setNome] = useState(nomeInicial)
  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [otpId, setOtpId] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [segundosReenvio, setSegundosReenvio] = useState(0)
  const inputCodigo = useRef<HTMLInputElement>(null)

  // "Reenviar código" libera depois de 60 s — sem isso a pessoa clica dez vezes
  // e o relay de e-mail bloqueia a caixa dela.
  useEffect(() => {
    if (segundosReenvio <= 0) return
    const t = setTimeout(() => setSegundosReenvio((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [segundosReenvio])

  useEffect(() => {
    if (etapa === 'codigo') inputCodigo.current?.focus()
  }, [etapa])

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Escreva o seu nome.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return setErro('Confira o e-mail: parece incompleto.')

    setOcupado(true)
    try {
      const r = await apiLote2.pedirCodigo(nome.trim(), email.trim().toLowerCase())
      setOtpId(r.otpId)
      setEtapa('codigo')
      setSegundosReenvio(60)
    } catch (err) {
      if (err instanceof ErroApi && err.status === 429) {
        setErro(err.message)
      } else {
        setErro('Não foi possível enviar o código agora. Tente de novo.')
      }
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const limpo = codigo.replace(/\D/g, '')
    if (limpo.length !== 6) return setErro('O código tem 6 dígitos.')

    setOcupado(true)
    try {
      // authWithCodigo é do PocketBase: cria a sessão e grava o token.
      await authWithCodigo(otpId, limpo)
      await onEntrou()
    } catch (err) {
      if (err instanceof ErroApi) {
        setErro(err.status === 400 ? 'Código inválido ou expirado. Peça outro.' : err.message)
      } else {
        setErro('Não foi possível entrar agora. Tente de novo.')
      }
    } finally {
      setOcupado(false)
    }
  }

  if (etapa === 'dados') {
    return (
      <form onSubmit={pedirCodigo} className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Ativar meu acesso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Grátis, presente do autor. Sem cartão e sem senha.
        </p>

        <div className="mt-4 space-y-3">
          {codigoConvite && (
            <div>
              <Label htmlFor="acesso-convite">Código do convite</Label>
              <div className="mt-1 flex h-11 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm">
                <span aria-hidden="true" className="text-green-700">
                  ✓
                </span>
                <span className="font-mono tracking-wide">{codigoConvite.toUpperCase()}</span>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="acesso-nome">Seu nome</Label>
            <Input
              id="acesso-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              className="mt-1 h-11"
              required
            />
          </div>
          <div>
            <Label htmlFor="acesso-email">Seu e-mail</Label>
            <Input
              id="acesso-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailTravado}
              aria-readonly={emailTravado}
              autoComplete="email"
              className="mt-1 h-11"
              required
            />
            {emailTravado && (
              <p className="mt-1 text-xs text-muted-foreground">
                Este convite é pessoal e vale para este e-mail.
              </p>
            )}
          </div>
        </div>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <Button type="submit" className="mt-4 h-11 w-full" disabled={ocupado}>
          {ocupado ? 'Enviando…' : tituloBotao}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Enviamos um código de 6 dígitos. Ele cria a sua conta e confirma o e-mail em um passo só.
        </p>

        {codigoConvite && (
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span aria-hidden="true">▶</span>
              Primeira aula liberada logo depois de entrar
            </li>
            <li className="flex items-start gap-1.5">
              <span aria-hidden="true">🏅</span>
              Certificado ao concluir as aulas
            </li>
          </ul>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={confirmar} className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Digite o código que chegou</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enviamos para <strong>{email}</strong>. Vale por 10 minutos.
      </p>

      <div className="mt-4">
        <Label htmlFor="acesso-codigo">Código de 6 dígitos</Label>
        <Input
          id="acesso-codigo"
          ref={inputCodigo}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          className="mt-1 h-14 text-center text-2xl tracking-[0.4em]"
          aria-describedby={erro ? 'acesso-erro' : undefined}
          required
        />
      </div>

      {erro && (
        <p id="acesso-erro" role="alert" className="mt-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <Button type="submit" className="mt-4 h-11 w-full" disabled={ocupado}>
        {ocupado ? 'Entrando…' : 'Confirmar e entrar'}
      </Button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={pedirCodigo}
          disabled={segundosReenvio > 0 || ocupado}
          className="min-h-11 text-primary underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {segundosReenvio > 0 ? `Reenviar em ${segundosReenvio}s` : 'Reenviar código'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEtapa('dados')
            setCodigo('')
            setErro('')
          }}
          className="min-h-11 text-muted-foreground underline"
        >
          Trocar e-mail
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Código expirado ou com problema?{' '}
        <a href="/ead/entrar" className="underline">
          Entrar de outra forma
        </a>
        .
      </p>
    </form>
  )
}
