import { Badge } from '@/components/ui/badge'

export function Author() {
  return (
    <section id="autor" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto bg-slate-50 rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-10 items-center">
          <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 rounded-full overflow-hidden border-4 border-white shadow-lg relative">
            <img
              src="https://img.usecurling.com/ppl/large?gender=male&seed=eduardocanal"
              alt="Eduardo Canal"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="text-center md:text-left">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 mb-4 px-3 py-1 text-sm font-medium border-0">
              Sobre o Autor
            </Badge>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Eduardo Canal</h2>
            <p className="text-primary font-medium mb-6">
              Especialista em Logística e Implementação WMS
            </p>

            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                Com mais de 15 anos de experiência prática na linha de frente da logística, Eduardo
                Canal liderou dezenas de projetos de implementação de WMS em operações de alta
                complexidade.
              </p>
              <p>
                Sua missão com este livro é democratizar o conhecimento técnico avançado,
                transformando teorias complexas em guias práticos e acionáveis para líderes e
                analistas de supply chain que buscam a excelência operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
