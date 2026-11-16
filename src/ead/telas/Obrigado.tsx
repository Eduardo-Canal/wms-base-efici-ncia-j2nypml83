// src/ead/telas/Obrigado.tsx → rota /ead/obrigado?pedido=id
//
// O QUE O DONO PEDIU (16/11): "na própria tela do EAD, após a confirmação do
// pagamento, já libere o acesso para ela".
//
// POR QUE ESTA TELA PRECISA CONSULTAR O SERVIDOR:
// o Mercado Pago devolve o comprador aqui ANTES de o webhook chegar (às vezes
// segundos antes). Se a tela só dissesse "obrigado", o aluno entraria em
// "minha área", não veria o curso e concluiria que a compra falhou.
//
// COMO FUNCIONA:
//   1. pergunta ao servidor, a cada 3 s, o status do pedido;
//   2. quando vier "pago", mostra o botão "Começar a assistir" e para de perguntar;
//   3. desiste depois de ~90 s e explica que o acesso aparece por e-mail —
//      porque boleto e pix podem levar horas e a tela não deve mentir.
//
// LIMITE IMPORTANTE: esta tela NÃO libera acesso sozinha. Ela só LÊ o status.
// Quem libera é o webhook (ou a reconciliação de 15 min). Se a tela decidisse,
// bastaria abrir a URL com um id de pedido para ganhar o curso.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button } from '@/components/ui/button'

type Estado = 'conferindo' | 'pago' | 'aguardando' | 'recusado' | 'erro'

export default function Obrigado() {
  const [params] = useSearchParams()
  const pedidoId = params.get('pedido') || ''
  const [estado, setEstado] = useState<Estado>('conferindo')
  const [tentativas, setTentativas] = useState(0)

  useEffect(() => {
    if (!pedidoId) return setEstado('aguardando')

    let vivo = true
    let contador = 0
    let timer: ReturnType<typeof setTimeout>

    async function conferir() {
      try {
        const r = await api.statusPedido(pedidoId)
        if (!vivo) return
        if (r.status === 'pago') return setEstado('pago')
        if (r.status === 'recusado' || r.status === 'cancelado' || r.status === 'reembolsado')
          return setEstado('recusado')
      } catch {
        // Falha de rede não muda o veredito: segue tentando.
      }
      contador++
      if (!vivo) return
      setTentativas(contador)
      // ~30 tentativas × 3 s = 90 s. Depois disso o caso é boleto/pix ou o
      // webhook atrasou: melhor explicar do que ficar girando.
      if (contador >= 30) return setEstado('aguardando')
      timer = setTimeout(conferir, 3000)
    }

    conferir()
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [pedidoId])

  if (estado === 'pago') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Acesso liberado</h1>
        <p className="mt-3 text-muted-foreground">
          Seu pagamento foi confirmado. O curso já está disponível na sua área.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Também enviamos um e-mail com o link para começar.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/ead/minha-area">Começar a assistir</Link>
          </Button>
          <Link to="/ead" className="text-sm text-muted-foreground underline">
            Ver os cursos
          </Link>
        </div>
      </div>
    )
  }

  if (estado === 'recusado') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Pagamento não aprovado</h1>
        <p className="mt-3 text-muted-foreground">
          O Mercado Pago não aprovou este pagamento. Nenhum valor foi cobrado do seu cartão.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/ead">Tentar de novo</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (estado === 'aguardando') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Estamos aguardando a confirmação</h1>
        <p className="mt-3 text-muted-foreground">
          O Mercado Pago ainda não confirmou este pagamento para nós.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Se você pagou com <strong>boleto ou pix</strong>, a liberação acontece quando o valor for
          compensado. Assim que confirmar, você recebe um e-mail com o link e o curso aparece na sua
          área — não precisa fazer mais nada.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/ead/minha-area">Ir para minha área</Link>
          </Button>
          <Link to="/ead" className="text-sm text-muted-foreground underline">
            Ver os cursos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Confirmando seu pagamento…</h1>
      <p className="mt-3 text-muted-foreground">
        Isso costuma levar poucos segundos. Não feche esta página.
      </p>
      {tentativas > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          Verificando com o Mercado Pago… ({tentativas})
        </p>
      )}
    </div>
  )
}
