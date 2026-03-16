import { CheckCircle2 } from 'lucide-react'
import bookCover from '@/assets/capa-livro-5b87b.jpg'

export function AboutBook() {
  const benefits = [
    'Compreensão profunda da arquitetura de um WMS',
    'Melhores práticas para preparação da equipe',
    'Estratégias de integração com ERPs e automação',
    'Mitigação de riscos durante o Go-Live',
    'Maximização do ROI após a implementação',
    'KPIs essenciais para monitorar o sucesso',
  ]

  return (
    <section id="about" className="py-20 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="order-2 lg:order-1 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-xl"></div>
              <img
                src={bookCover}
                alt="Detalhes do Livro WMS"
                className="relative z-10 w-full max-w-[350px] rounded-lg shadow-xl border border-border/50"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Sobre a Obra</h2>
              <div className="w-12 h-1 bg-primary rounded-full"></div>
            </div>

            <p className="text-lg text-muted-foreground">
              O <strong>Guia Masterclass de Implementação WMS</strong> é o recurso definitivo para
              profissionais que buscam excelência na gestão de armazéns. Fruto de anos de
              experiência prática, este livro desmistifica o complexo processo de adoção de um
              Warehouse Management System.
            </p>

            <p className="text-lg text-muted-foreground">
              Não se trata apenas de software, mas de uma transformação profunda nos processos
              logísticos. Aprenda a alinhar tecnologia, pessoas e processos para alcançar resultados
              extraordinários na sua cadeia de suprimentos.
            </p>

            <div className="pt-4">
              <h3 className="text-xl font-semibold mb-4">O que você vai aprender:</h3>
              <ul className="grid sm:grid-cols-2 gap-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
