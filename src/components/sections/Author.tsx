import { Facebook, Linkedin, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import autorImage from '@/assets/autor-4c853.jpg'

export function Author() {
  return (
    <section id="sobre-o-autor" className="py-24 bg-background border-y border-border/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="flex justify-center lg:justify-end order-first lg:order-none">
            <div className="relative group">
              <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 overflow-hidden rounded-2xl border-4 border-muted shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2">
                <img
                  src={autorImage}
                  alt="Autor do Guia Masterclass de Implementação WMS"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8 max-w-2xl">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Sobre o Autor
              </h2>
              <p className="text-xl text-primary font-semibold">
                Especialista em Logística e Implementação WMS
              </p>
            </div>

            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>
                Com uma trajetória dedicada à excelência operacional, o autor possui profunda
                expertise na transformação de cadeias de suprimentos e na gestão estratégica de
                armazéns.
              </p>
              <p>
                Sua vivência técnica e prática abrange o planejamento minucioso e a execução de
                sistemas WMS (Warehouse Management System), ajudando organizações a superarem
                desafios logísticos, reduzirem custos e aumentarem a eficiência de suas operações.
              </p>
              <p>
                No{' '}
                <strong className="text-foreground">"Guia Masterclass de Implementação WMS"</strong>
                , ele compartilha metodologias validadas em campo, entregando um roteiro prático
                para que gestores e analistas possam liderar projetos de tecnologia logística com
                segurança e resultados expressivos.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                asChild
                variant="outline"
                className="gap-2 transition-transform hover:-translate-y-1 duration-300"
              >
                <a
                  href="https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn do Guia Masterclass"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="gap-2 transition-transform hover:-translate-y-1 duration-300"
              >
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook do Guia Masterclass"
                >
                  <Facebook className="w-4 h-4" />
                  Facebook
                </a>
              </Button>
              <Button
                asChild
                className="gap-2 transition-transform hover:-translate-y-1 duration-300"
              >
                <a
                  href="https://a.co/d/01x2227p"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Comprar Guia Masterclass na Amazon"
                >
                  <BookOpen className="w-4 h-4" />
                  Amazon
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Author
