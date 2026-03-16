import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { blogPosts } from '@/data/blog'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, BookOpen, Clock } from 'lucide-react'

export default function BlogList() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">
      <div className="max-w-3xl mb-16">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-6 text-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
          Blog WMS Masterclass
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Artigos, insights e melhores práticas sobre a jornada de implementação, otimização e
          gestão estratégica do seu Warehouse Management System.
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <Card
            key={post.id}
            className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-background border-border/60"
          >
            <div className="aspect-video w-full overflow-hidden relative group">
              <Link to={`/blog/${post.slug}`} className="absolute inset-0 z-10">
                <span className="sr-only">Ler artigo {post.title}</span>
              </Link>
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-3">
                <span className="text-primary">{post.date}</span>
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {post.readTime}
                </span>
              </div>
              <CardTitle className="line-clamp-2 text-2xl leading-tight hover:text-primary transition-colors">
                <Link to={`/blog/${post.slug}`}>{post.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <CardDescription className="line-clamp-3 text-base">{post.excerpt}</CardDescription>
            </CardContent>
            <CardFooter className="pt-2 pb-6">
              <Button variant="ghost" className="w-full justify-between group h-12" asChild>
                <Link to={`/blog/${post.slug}`}>
                  Ler Artigo Completo
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
