import { Button } from '@/components/ui/button'
import { Facebook, Linkedin, Mail } from 'lucide-react'

export function Social() {
  return (
    <section id="contact" className="py-20 bg-background border-t border-b border-border">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Fique Conectado</h2>
        <p className="max-w-[600px] mx-auto text-lg text-muted-foreground mb-10">
          Acompanhe as novidades do livro, participe das discussões sobre WMS e entre em contato com
          o autor.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            className="bg-[#0A66C2] hover:bg-[#084e96] text-white border-transparent"
            asChild
          >
            <a
              href="https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="mr-2 h-5 w-5" />
              LinkedIn do Livro
            </a>
          </Button>

          <Button
            size="lg"
            className="bg-[#1877F2] hover:bg-[#165eca] text-white border-transparent"
            asChild
          >
            <a
              href="https://www.facebook.com/349781528216266"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook className="mr-2 h-5 w-5" />
              Página no Facebook
            </a>
          </Button>

          <Button size="lg" variant="outline" asChild>
            <a href="mailto:eduardo.canal@zionlogtec.com.br?subject=Contato%20-%20Guia%20Masterclass%20de%20Implementa%C3%A7%C3%A3o%20WMS">
              <Mail className="mr-2 h-5 w-5" />
              Falar com o Autor
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
