import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import { AMAZON_VOL1, AMAZON_VOL2 } from '@/lib/links'

export function FinalCTA() {
  return (
    <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://img.usecurling.com/p/1920/600?q=warehouse&color=blue')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Pronto para Transformar a Gestão do seu Armazém?
        </h2>
        <p className="max-w-[700px] mx-auto text-lg md:text-xl text-primary-foreground/80 mb-10">
          Adquira o "Guia Masterclass de Implementação WMS" e construa a base para a eficiência na
          sua operação logística. Dois volumes, do fundamento à maturidade de uso.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            variant="secondary"
            className="h-14 px-8 text-base font-semibold text-primary"
            asChild
          >
            <a href={AMAZON_VOL1} target="_blank" rel="noopener noreferrer">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Volume 1 na Amazon
            </a>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-14 px-8 text-base font-semibold text-primary"
            asChild
          >
            <a href={AMAZON_VOL2} target="_blank" rel="noopener noreferrer">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Volume 2 na Amazon
            </a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-primary-foreground/60">
          Disponível em formato físico e Kindle.
        </p>
      </div>
    </section>
  )
}
