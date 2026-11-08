import { Button } from '@/components/ui/button'
import { BookOpen, ShoppingCart } from 'lucide-react'
import bookCover from '@/assets/capa-livro-5b87b.jpg'
import { AMAZON_VOL1, AMAZON_VOL2, AMAZON_AUTOR } from '@/lib/links'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                Volumes 1 e 2 disponíveis
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl text-foreground">
                WMS Guia Masterclass <br className="hidden sm:inline" />
                <span className="text-primary">de Implementação</span>
              </h1>
              <p className="max-w-[600px] text-lg text-muted-foreground sm:text-xl font-medium">
                Construindo a base para a eficiência - O Caminho para a Supremacia na Gestão de
                Armazéns
              </p>
              <p className="max-w-[600px] text-base text-muted-foreground">Por Eduardo Canal</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="h-auto px-6 py-4 text-base shadow-lg hover:shadow-xl transition-all"
                asChild
              >
                <a href={AMAZON_VOL1} target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="mr-2 h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-xs font-normal opacity-80">Volume 1</span>
                    <span>Comprar na Amazon</span>
                  </span>
                </a>
              </Button>
              <Button
                size="lg"
                className="h-auto px-6 py-4 text-base shadow-lg hover:shadow-xl transition-all"
                asChild
              >
                <a href={AMAZON_VOL2} target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="mr-2 h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-xs font-normal opacity-80">Volume 2</span>
                    <span>Comprar na Amazon</span>
                  </span>
                </a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <a href="#about">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Conheça o Livro
                </a>
              </Button>
              <Button size="lg" variant="ghost" className="h-12 px-6 text-base" asChild>
                <a href={AMAZON_AUTOR} target="_blank" rel="noopener noreferrer">
                  Todos os livros do autor
                </a>
              </Button>
            </div>

            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-background"
                    src={`https://img.usecurling.com/ppl/thumbnail?seed=${i}`}
                    alt="Leitor"
                  />
                ))}
              </div>
              <p>Junte-se a dezenas de profissionais de logística.</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[400px] lg:max-w-none lg:ml-auto perspective-1000">
            <div className="relative w-full rounded-xl shadow-2xl transition-transform duration-500 hover:scale-105 hover:-rotate-y-6 bg-muted">
              <img
                src={bookCover}
                alt="Capa do Livro: WMS Guia Masterclass de Implementação"
                className="w-full h-auto rounded-xl object-cover"
                style={{ aspectRatio: '2/3' }}
              />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/10"></div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -z-10 -top-12 -right-12 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="absolute -z-10 -bottom-12 -left-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </section>
  )
}
