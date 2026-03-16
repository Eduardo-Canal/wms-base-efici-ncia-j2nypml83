import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Para quem é destinado este guia?',
    answer:
      'Para gerentes de logística, analistas de supply chain, gerentes de projeto, líderes de operação e qualquer profissional envolvido direta ou indiretamente na seleção e implementação de um WMS.',
  },
  {
    question: 'Preciso ter conhecimento prévio avançado em TI?',
    answer:
      'Não. O livro foi escrito de forma a conectar a visão de negócios e operações com a tecnologia. Abordamos a parte sistêmica de maneira clara, focada em processos e resultados ao invés de código.',
  },
  {
    question: 'O livro aborda integrações com ERPs?',
    answer:
      'Sim! Há um capítulo dedicado a explicar os fluxos de integração mais comuns (como recebimento, separação, e atualização de saldo) e as melhores práticas para garantir que WMS e ERP conversem sem falhas.',
  },
  {
    question: 'Como o livro ajuda no "Go-Live"?',
    answer:
      'Apresentamos um checklist robusto e estratégias de mitigação de risco para as fases de testes integrados, treinamento da equipe e a virada de chave, minimizando o impacto na operação real.',
  },
  {
    question: 'O conteúdo se aplica a qualquer sistema WMS do mercado?',
    answer:
      'Absolutamente. As metodologias, boas práticas, mapeamento de processos e KPIs descritos são agnósticos, ou seja, servem como base estrutural independente de você utilizar SAP EWM, Manhattan, Blue Yonder, TOTVS, Sankhya, etc.',
  },
]

export function FAQ() {
  return (
    <section id="faq" className="py-24 bg-background border-t border-border/40">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perguntas Frequentes</h2>
          <p className="text-lg text-muted-foreground">
            Tire suas principais dúvidas sobre o conteúdo e formato do Guia Masterclass.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-lg font-medium hover:text-primary py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground leading-relaxed pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
