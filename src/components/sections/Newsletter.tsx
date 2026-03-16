import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function Newsletter() {
  const [email, setEmail] = useState('')
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    toast({
      title: 'Inscrição confirmada com sucesso!',
      description: 'Você passará a receber nossas atualizações sobre WMS e logística.',
    })
    setEmail('')
  }

  return (
    <section className="py-24 bg-primary/5 border-y border-primary/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Assine nossa Newsletter</h2>
          <p className="text-lg text-muted-foreground">
            Receba artigos exclusivos, dicas práticas de implementação e novidades sobre o mundo do
            WMS diretamente na sua caixa de entrada.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row gap-3 mt-4">
            <Input
              type="email"
              placeholder="Seu melhor e-mail"
              className="h-12 bg-background text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" size="lg" className="h-12 sm:w-auto w-full">
              Inscrever-se
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            Prometemos não enviar spam. Você pode cancelar sua inscrição a qualquer momento.
          </p>
        </div>
      </div>
    </section>
  )
}
