// TEMPORÁRIO — painel: cartão "IP visto pelo servidor".
//
// PEDIDO DO DONO (19/11): o teste das duas redes não pode ser feito abrindo a
// URL do /diag/ip no navegador, porque a navegação não leva o token de sessão e
// o endpoint responde 401. Este cartão chama o endpoint COM a sessão do admin e
// mostra ip_visto e ip_hash_curto.
//
// VIDA ÚTIL CURTA E DECLARADA: o dono chama de duas redes (wifi e 4G), compara
// os hashes e então pede a remoção. Para remover: apagar este arquivo e a linha
// `<DiagnosticoIp />` em Admin.tsx; o endpoint diag-ip.pb.js sai junto.
//
// POR QUE NO PAINEL: é a única tela que já exige admin e já tem o token na
// memória. Outro lugar teria de repetir a checagem de permissão, e repetir
// checagem é como se abre furo.
import { useState } from 'react'
import { api } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DiagIp = {
  ip_visto: string
  ip_hash_curto: string
  cabecalhos_recebidos: { 'x-forwarded-for': string; 'x-real-ip': string }
  trusted_proxy: { ativo: boolean; headers: string; efeito: string }
}

export default function DiagnosticoIp() {
  const [dados, setDados] = useState<DiagIp | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function consultar() {
    setCarregando(true)
    setErro('')
    try {
      // A chamada vai pelo cliente da API, que anexa o token da sessão.
      const r = await api.diagIp()
      setDados(r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Card className="mt-10 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">IP visto pelo servidor (teste temporário)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Chame uma vez no <strong>wifi</strong> e outra no <strong>4G</strong>. Se{' '}
          <code>ip_hash_curto</code> mudar, o servidor distingue pessoas e o limite de requisições
          conta por aluno. Se não mudar, todos chegam com o IP do proxy e o limite vale para o site
          inteiro.
        </p>

        <Button className="mt-3" onClick={consultar} disabled={carregando}>
          {carregando ? 'Consultando…' : 'Consultar agora'}
        </Button>

        {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {dados && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">IP visto</dt>
              <dd className="font-mono">{dados.ip_visto || '(vazio)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Hash curto</dt>
              <dd className="font-mono">{dados.ip_hash_curto || '(vazio)'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Cabeçalhos recebidos</dt>
              <dd className="font-mono text-xs">
                x-forwarded-for: {dados.cabecalhos_recebidos['x-forwarded-for'] || '(vazio)'}
                <br />
                x-real-ip: {dados.cabecalhos_recebidos['x-real-ip'] || '(vazio)'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Proxy confiável</dt>
              <dd>
                {dados.trusted_proxy.ativo ? 'configurado' : 'DESLIGADO'}
                {dados.trusted_proxy.headers ? ` — ${dados.trusted_proxy.headers}` : ''}
                <br />
                <span className="text-xs text-muted-foreground">{dados.trusted_proxy.efeito}</span>
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
