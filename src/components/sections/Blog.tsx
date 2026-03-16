import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { blogPosts } from '@/data/blog'

export function Blog() {
  const recentPosts = blogPosts.slice(0, 3)

  return (
    <section id="blog" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-4 mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Artigos e Insights</h2>
          <p className="max-w-[700px] text-lg text-muted-foreground">
            Acompanhe as últimas publicações, dicas valiosas e discussões sobre a gestão estratégica
            de armazéns.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {recentPosts.map((post) => (
            <Card
              key={post.id}
              className="flex flex-col overflow-hidden transition-all hover:shadow-md border-border/50 bg-background"
            >
              <div className="aspect-video w-full overflow-hidden relative group">
                <Link to={`/blog/${post.slug}`} className="absolute inset-0 z-10">
                  <span className="sr-only">Ler {post.title}</span>
                </Link>
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <CardHeader className="pb-3">
                <div className="text-sm font-medium text-primary mb-2">{post.date}</div>
                <CardTitle className="line-clamp-2 text-xl leading-tight hover:text-primary transition-colors">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="line-clamp-3 text-base">{post.excerpt}</CardDescription>
              </CardContent>
              <CardFooter className="pt-2">
                <Button variant="ghost" className="w-full justify-between group" asChild>
                  <Link to={`/blog/${post.slug}`}>
                    Ler Artigo Completo
                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button size="lg" variant="outline" className="h-14 px-8" asChild>
            <Link to="/blog">
              <BookOpen className="mr-2 h-5 w-5" />
              Ver todos os artigos do Blog
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
