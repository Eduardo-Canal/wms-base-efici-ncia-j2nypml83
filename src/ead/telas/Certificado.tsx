// Certificado.tsx → rota /certificado/:codigo  (PÚBLICA, sem login)
//
// O QUE ISTO RESOLVE: certificado sem conferência é um PDF que qualquer um
// edita no editor de imagem. Aqui um recrutador (ou qualquer pessoa) com o
// código confere nome, curso, carga horária, assinante e data — sem que a
// gente exponha a lista de alunos.
//
// POR QUE FORA DE /ead: precisa funcionar sem login e sem a área liberada. É o
// mesmo motivo do /reset-password.
//
// ── A RUBRICA NÃO APARECE AQUI (item 14 do lote 1) ────────────────────────
// A assinatura do Eduardo é dado pessoal dele e esta página é aberta a quem
// tiver o link. O que prova o certificado é o CÓDIGO, não o desenho da
// assinatura. A imagem continua disponível para o aluno, na tela de conclusão,
// por um endpoint que confere o certificado.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Dados = {
  valido: boolean
  codigo: string
  nome_aluno: string
  titulo_curso: string
  carga_horas: number
  assinante_nome: string
  assinante_cargo: string
  tem_assinatura?: boolean
  emitido_em: string
}

export default function Certificado() {
  const { codigo = '' } = useParams<{ codigo: string }>()
  const [dados, setDados] = useState<Dados | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalido' | 'erro'>('carregando')

  useEffect(() => {
    if (!codigo) return setEstado('invalido')
    api
      .verificarCertificado(codigo)
      .then((r) => {
        setDados(r as Dados)
        setEstado('ok')
      })
      .catch(() => setEstado('invalido'))
  }, [codigo])

  function dataBR(iso: string): string {
    if (!iso) return ''
    try {
      return new Date(iso.replace(' ', 'T')).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  if (estado === 'carregando')
    return <p className="px-4 py-20 text-center text-muted-foreground">Verificando…</p>

  if (estado === 'invalido' || !dados)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Certificado não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Não encontramos nenhum certificado com este código. Confira se digitou corretamente — o
          formato é <span className="font-mono">WMS-XXXX-XXXX</span>.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Voltar ao site</Link>
        </Button>
      </div>
    )

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Certificado válido</p>
          <h1 className="mt-2 text-lg font-semibold">{dados.titulo_curso}</h1>

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Conferido a</dt>
              <dd className="font-medium">{dados.nome_aluno}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Carga horária</dt>
              <dd className="font-medium">
                {dados.carga_horas > 0 ? `${dados.carga_horas} horas` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Emitido em</dt>
              <dd className="font-medium">{dataBR(dados.emitido_em)}</dd>
            </div>
            {dados.assinante_nome && (
              <div>
                <dt className="text-xs text-muted-foreground">Assinado por</dt>
                {/* Só nome e cargo. A rubrica não sai na página pública. */}
                <dd className="font-medium">
                  {dados.assinante_nome}
                  {dados.assinante_cargo ? ` — ${dados.assinante_cargo}` : ''}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">Código de verificação</dt>
              <dd className="font-mono font-medium">{dados.codigo}</dd>
            </div>
          </dl>

          <p className="mt-6 text-xs text-muted-foreground">
            Esta página confirma que o certificado foi emitido pela plataforma WMS Base para
            Eficiência. Nenhum dado de contato é exibido.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
