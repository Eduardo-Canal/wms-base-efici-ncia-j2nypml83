import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.8) 0%, transparent 50%)',
          }}
        ></div>
      </div>
      <div className="container mx-auto px-4 relative z-10 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Pronto para levar seu armazém ao próximo nível?
        </h2>
        <p className="text-primary-foreground/80 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Não deixe a eficiência da sua operação para depois. Comece a aplicar as estratégias
          comprovadas da Masterclass hoje mesmo.
        </p>
        <Button
          size="lg"
          className="bg-secondary text-secondary-foreground hover:bg-white hover:text-slate-900 text-lg h-16 px-10 rounded-full shadow-2xl hover:scale-105 transition-all duration-300"
          asChild
        >
          <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
            <ShoppingCart className="mr-2 h-6 w-6" />
            Comprar na Amazon Agora
          </a>
        </Button>
      </div>
    </section>
  )
}
