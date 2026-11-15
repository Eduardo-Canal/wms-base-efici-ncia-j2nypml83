// src/ead/telas/Obrigado.tsx → rota /ead/obrigado?pedido=id
// Tela de retorno do Checkout Pro. Não libera nada: quem libera é o webhook.
// Aqui só dizemos a verdade — "aguardando confirmação" — e convidamos a entrar.
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Obrigado() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Pagamento recebido</h1>
      <p className="mt-3 text-muted-foreground">
        Estamos confirmando com o Mercado Pago. Isso costuma levar poucos segundos — o acesso
        aparece na sua área assim que a confirmação chega.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Se você pagou com boleto ou pix, a liberação acontece quando o pagamento for compensado.
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
