import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Linkedin, Facebook, Users, ArrowUpRight } from 'lucide-react'

export function Social() {
  return (
    <section id="social" className="py-24 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Junte-se à Comunidade</h2>
          <p className="text-lg text-slate-600">
            Acompanhe as atualizações, dicas exclusivas de implementação e faça networking com
            outros profissionais de logística.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow border-slate-200 group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
              <Linkedin className="w-32 h-32" />
            </div>
            <CardContent className="p-8 relative z-10 flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 bg-[#0A66C2]/10 rounded-full flex items-center justify-center mb-6">
                <Linkedin className="h-8 w-8 text-[#0A66C2]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">LinkedIn</h3>
              <p className="text-slate-600 mb-8 flex-1">
                Siga a página oficial para artigos profundos, discussões técnicas e atualizações
                sobre o mundo WMS.
              </p>
              <Button
                variant="outline"
                className="w-full group-hover:bg-[#0A66C2] group-hover:text-white transition-colors border-slate-300"
                asChild
              >
                <a
                  href="https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conectar no LinkedIn <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-slate-200 group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
              <Facebook className="w-32 h-32" />
            </div>
            <CardContent className="p-8 relative z-10 flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 bg-[#1877F2]/10 rounded-full flex items-center justify-center mb-6">
                <Facebook className="h-8 w-8 text-[#1877F2]" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">Grupo no Facebook</h3>
              <p className="text-slate-600 mb-8 flex-1">
                Participe da comunidade "Guia Masterclass de Implementação WMS" para tirar dúvidas e
                compartilhar experiências.
              </p>
              <Button
                variant="outline"
                className="w-full group-hover:bg-[#1877F2] group-hover:text-white transition-colors border-slate-300"
                asChild
              >
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Participar do Grupo <Users className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
