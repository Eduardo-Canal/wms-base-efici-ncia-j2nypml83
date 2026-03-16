import { useParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { blogPosts } from '@/data/blog'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Clock, Facebook, Linkedin, ShoppingCart } from 'lucide-react'
import NotFound from './NotFound'

export default function BlogPost() {
  const { slug } = useParams()
  const post = blogPosts.find((p) => p.slug === slug)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  if (!post) {
    return <NotFound />
  }

  const shareUrl = window.location.href

  return (
    <article className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
      <Link
        to="/blog"
        className="inline-flex items-center font-medium text-muted-foreground hover:text-primary mb-10 transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para todos os artigos
      </Link>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 leading-tight text-foreground">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center text-muted-foreground gap-6">
          <div className="flex items-center font-medium text-foreground">Por {post.author}</div>
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            {post.date}
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            {post.readTime} leitura
          </div>
        </div>
      </header>

      <div className="w-full rounded-2xl overflow-hidden mb-14 shadow-lg ring-1 ring-border/50">
        <img
          src={post.imageUrl}
          alt={post.title}
          className="w-full h-auto object-cover aspect-[21/9]"
        />
      </div>

      <div className="prose prose-lg md:prose-xl max-w-none mb-16 text-foreground/90">
        {post.content.map((paragraph, idx) => (
          <p key={idx} className="mb-8 leading-relaxed text-lg md:text-xl font-serif">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="bg-primary/5 rounded-2xl p-8 md:p-12 mb-16 flex flex-col md:flex-row items-center justify-between gap-8 border border-primary/20 shadow-sm">
        <div className="text-center md:text-left">
          <h3 className="text-2xl md:text-3xl font-bold mb-3">Aprofunde seu conhecimento</h3>
          <p className="text-lg text-muted-foreground">
            Adquira o Guia Masterclass completo e transforme definitivamente a gestão do seu
            armazém.
          </p>
        </div>
        <Button size="lg" className="shrink-0 h-14 px-8 text-base shadow-lg" asChild>
          <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Comprar na Amazon
          </a>
        </Button>
      </div>

      <footer className="border-t border-border pt-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="font-semibold text-lg text-foreground">Gostou do artigo? Compartilhe:</div>
        <div className="flex space-x-4">
          <Button
            variant="outline"
            className="gap-2 hover:bg-[#0A66C2] hover:text-white transition-colors border-[#0A66C2] text-[#0A66C2]"
            asChild
          >
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
          </Button>
          <Button
            variant="outline"
            className="gap-2 hover:bg-[#1877F2] hover:text-white transition-colors border-[#1877F2] text-[#1877F2]"
            asChild
          >
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          </Button>
        </div>
      </footer>
    </article>
  )
}
