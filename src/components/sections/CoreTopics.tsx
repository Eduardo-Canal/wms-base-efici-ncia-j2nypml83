import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const topics = [
  {
    id: 'item-1',
    title: 'Fundamentos de WMS',
    content:
      'Compreenda a arquitetura central de um WMS, como ele difere de um ERP tradicional e quais são os pré-requisitos para uma operação de sucesso. Abordamos a teoria necessária para fundamentar a prática.',
  },
  {
    id: 'item-2',
    title: 'Planejamento de Implementação',
    content:
      'Do mapeamento de processos AS-IS para TO-BE, até a seleção de fornecedores e criação do cronograma do projeto. Aprenda a montar a equipe ideal e gerenciar stakeholders e expectativas.',
  },
  {
    id: 'item-3',
    title: 'Otimização de Processos de Estoque',
    content:
      'Técnicas detalhadas sobre recebimento, armazenagem (putaway), ressuprimento, separação (picking), conferência e expedição. Descubra como o WMS automatiza e acelera cada uma dessas etapas.',
  },
  {
    id: 'item-4',
    title: 'Gestão de Equipe e Tecnologia',
    content:
      'O WMS só funciona com pessoas. Explore estratégias de treinamento, gestão de mudança (Change Management), e como integrar o WMS com tecnologias complementares como coletores RF, Voice Picking e automação de esteiras.',
  },
]

export function CoreTopics() {
  return (
    <section id="conteudo" className="py-24 bg-slate-50 border-y border-slate-200">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              O que você vai aprender
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Uma imersão completa nos pilares que transformam um armazém caótico em uma máquina de
              precisão. O conteúdo é estruturado de forma lógica para acompanhar a jornada do
              projeto.
            </p>

            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
              {topics.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id} className="border-slate-200">
                  <AccordionTrigger className="text-left text-lg font-semibold text-slate-800 hover:text-primary py-5">
                    {topic.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 leading-relaxed text-base pb-5">
                    {topic.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://img.usecurling.com/p/800/1000?q=warehouse%20technology&color=blue"
                alt="Warehouse Technology"
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex items-end p-8">
                <p className="text-white text-xl font-medium">
                  "A tecnologia só amplifica a eficiência de um processo bem desenhado."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
