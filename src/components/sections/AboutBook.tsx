import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Settings, Zap } from 'lucide-react'

const features = [
  {
    title: 'Estratégia',
    description:
      'Aprenda a alinhar a tecnologia WMS com os objetivos de negócios para maximizar o ROI e o desempenho operacional.',
    icon: Target,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    title: 'Implementação',
    description:
      'Um passo a passo rigoroso para evitar armadilhas comuns, garantindo uma transição suave e adoção total da equipe.',
    icon: Settings,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    title: 'Eficiência',
    description:
      'Táticas avançadas para otimização de rotas de picking, gestão de inventário em tempo real e redução de custos.',
    icon: Zap,
    color: 'text-secondary',
    bg: 'bg-secondary/20',
  },
]

export function AboutBook() {
  return (
    <section id="o-livro" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Por que este guia é essencial?
          </h2>
          <p className="text-lg text-slate-600">
            A implementação de um Warehouse Management System (WMS) é um dos maiores desafios
            logísticos. Este livro decodifica a complexidade e entrega um framework comprovado para
            o sucesso.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-slate-100 shadow-sm hover:shadow-elevation transition-all duration-300 group hover:-translate-y-1"
            >
              <CardHeader>
                <div
                  className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
