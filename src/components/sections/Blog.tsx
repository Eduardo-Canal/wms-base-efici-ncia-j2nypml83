import { ArrowRight, Linkedin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const blogPosts = [
  {
    id: 1,
    title: 'A Importância de um WMS na Cadeia de Suprimentos',
    excerpt:
      'Descubra como a implementação correta de um Sistema de Gerenciamento de Armazém pode transformar a eficiência operacional da sua empresa e reduzir custos de forma significativa.',
    date: '10 Mar 2026',
    link: 'https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/',
    imageUrl: 'https://img.usecurling.com/p/400/250?q=warehouse&color=blue',
  },
  {
    id: 2,
    title: 'Os Desafios Iniciais da Implementação',
    excerpt:
      'Muitos projetos de WMS falham não pela tecnologia, mas pela falta de preparação da equipe. Neste artigo, abordo os principais pontos de atenção antes do go-live.',
    date: '05 Mar 2026',
    link: 'https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/',
    imageUrl: 'https://img.usecurling.com/p/400/250?q=teamwork&color=orange',
  },
  {
    id: 3,
    title: 'Integração do WMS com ERPs de Mercado',
    excerpt:
      'Entenda por que a comunicação perfeita entre o seu sistema de gestão empresarial e o WMS é crucial para a integridade dos dados e o sucesso da operação.',
    date: '28 Fev 2026',
    link: 'https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/',
    imageUrl: 'https://img.usecurling.com/p/400/250?q=technology&color=cyan',
  },
]

export function Blog() {
  return (
    <section id="blog" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-2 text-primary">
            <Linkedin className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Artigos e Insights</h2>
          <p className="max-w-[700px] text-lg text-muted-foreground">
            Acompanhe as últimas publicações e discussões sobre gestão de armazéns diretamente do
            nosso LinkedIn.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Card
              key={post.id}
              className="flex flex-col overflow-hidden transition-all hover:shadow-md"
            >
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <CardHeader>
                <div className="text-sm text-muted-foreground mb-2">{post.date}</div>
                <CardTitle className="line-clamp-2 text-xl leading-tight hover:text-primary transition-colors">
                  <a href={post.link} target="_blank" rel="noopener noreferrer">
                    {post.title}
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="line-clamp-3 text-base">{post.excerpt}</CardDescription>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="w-full justify-between" asChild>
                  <a href={post.link} target="_blank" rel="noopener noreferrer">
                    Ler no LinkedIn
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button size="lg" variant="outline" asChild>
            <a
              href="https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="mr-2 h-5 w-5" />
              Siga a página oficial no LinkedIn
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
