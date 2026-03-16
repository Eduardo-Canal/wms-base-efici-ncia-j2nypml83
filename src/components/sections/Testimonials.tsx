import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Card, CardContent } from '@/components/ui/card'
import { Quote, Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Carlos Silva',
    role: 'Gerente de Logística, TechLog',
    content:
      'O guia transformou a maneira como encaramos a implementação do WMS na nossa empresa. Um passo a passo absolutamente essencial para não errar no Go-Live.',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=10',
  },
  {
    name: 'Mariana Costa',
    role: 'Analista de Supply Chain',
    content:
      'A didática do autor é incrível. Ele consegue traduzir os conceitos técnicos para a realidade do chão de fábrica. Reduzimos nosso tempo de separação em 30%.',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=15',
  },
  {
    name: 'Roberto Mendes',
    role: 'Diretor de Operações',
    content:
      'Recomendo este livro para toda minha equipe. É mais do que teoria, é vivência prática pura condensada de forma magistral e direta.',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=22',
  },
  {
    name: 'Juliana Freitas',
    role: 'Consultora de Processos',
    content:
      'Já participei de 4 implementações e ainda assim aprendi muito com a visão sistêmica trazida neste guia. A parte de integração com ERP é impecável.',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=31',
  },
]

export function Testimonials() {
  return (
    <section
      id="depoimentos"
      className="py-24 bg-slate-50 border-y border-slate-200 overflow-hidden"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl text-slate-900">
            Quem já leu e recomenda
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Veja o impacto que o Guia Masterclass de Implementação WMS tem gerado nas operações
            logísticas pelo Brasil.
          </p>
        </div>

        <div className="max-w-5xl mx-auto px-8 sm:px-12 relative">
          <Carousel
            opts={{
              align: 'start',
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {testimonials.map((item, index) => (
                <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/2">
                  <Card className="h-full bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-8 flex flex-col h-full">
                      <Quote className="h-10 w-10 text-primary/20 mb-4 shrink-0" />
                      <div className="flex space-x-1 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <p className="text-slate-700 text-lg mb-8 flex-1 italic">"{item.content}"</p>
                      <div className="flex items-center space-x-4 mt-auto">
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/10"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-500">{item.role}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden sm:block">
              <CarouselPrevious className="-left-12 bg-white border-slate-200 text-slate-600 hover:text-primary" />
              <CarouselNext className="-right-12 bg-white border-slate-200 text-slate-600 hover:text-primary" />
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  )
}
