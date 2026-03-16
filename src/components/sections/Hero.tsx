import { Button } from '@/components/ui/button'
import { ShoppingCart, Star } from 'lucide-react'

export function Hero() {
  return (
    <section
      id="hero"
      className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50"
    >
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
        <img
          src="https://img.usecurling.com/p/1920/1080?q=warehouse%20logistics&color=blue"
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div
            className="order-2 lg:order-1 flex flex-col items-center lg:items-start text-center lg:text-left opacity-0 animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6">
              <Star className="h-4 w-4 fill-primary" />
              <span>Lançamento Exclusivo</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              Guia Masterclass de <br className="hidden lg:block" />
              <span className="text-primary">Implementação WMS</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl font-medium leading-relaxed">
              Construindo a base para a eficiência: O Caminho para a Supremacia na Gestão de
              Armazéns.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 transition-transform text-base h-14 px-8 shadow-lg"
                asChild
              >
                <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Adquira na Amazon
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-14 px-8 text-base"
                asChild
              >
                <a href="#conteudo">Ver Conteúdo</a>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-4 text-sm text-slate-500 font-medium">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    src={`https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${i}`}
                    alt="Leitor"
                    className="w-8 h-8 rounded-full border-2 border-white"
                  />
                ))}
              </div>
              <p>Junte-se a centenas de profissionais de logística.</p>
            </div>
          </div>

          <div
            className="order-1 lg:order-2 flex justify-center opacity-0 animate-fade-in-up"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="relative animate-float perspective-1000">
              <div className="absolute -inset-4 bg-primary/20 rounded-xl blur-2xl z-0 transform -rotate-6"></div>
              <img
                src="https://img.usecurling.com/p/500/750?q=book%20cover%20logistics&color=blue"
                alt="Capa do Livro WMS Masterclass"
                className="relative z-10 w-[280px] sm:w-[360px] lg:w-[420px] rounded-r-lg rounded-l-sm shadow-2xl transform rotate-y-[-10deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-y-0 hover:rotate-x-0"
                style={{
                  boxShadow:
                    '-15px 10px 30px rgba(0,0,0,0.3), inset 3px 0 5px rgba(255,255,255,0.4)',
                  borderLeft: '4px solid #003b61',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
