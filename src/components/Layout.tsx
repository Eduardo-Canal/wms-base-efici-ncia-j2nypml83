import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu, BookOpen, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { name: 'O Livro', href: '#o-livro' },
  { name: 'Conteúdo', href: '#conteudo' },
  { name: 'Autor', href: '#autor' },
  { name: 'Redes Sociais', href: '#social' },
]

export default function Layout() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
      setShowScrollTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <header
        className={cn(
          'fixed top-0 z-50 w-full transition-all duration-300',
          isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm border-b' : 'bg-transparent',
        )}
      >
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <a
            href="#"
            className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <BookOpen className="h-6 w-6" />
            <span className="hidden sm:inline-block">WMS Masterclass</span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Button
              asChild
              className="hidden md:flex bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-subtle hover:scale-105 transition-all"
            >
              <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                Comprar Agora
              </a>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetTitle className="text-left mb-4">Menu</SheetTitle>
                <SheetDescription className="sr-only">Navegação do site</SheetDescription>
                <nav className="flex flex-col gap-4 mt-8">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      className="text-lg font-medium text-slate-600 hover:text-primary transition-colors py-2 border-b border-slate-100"
                    >
                      {link.name}
                    </a>
                  ))}
                  <Button asChild className="mt-4 bg-secondary text-secondary-foreground w-full">
                    <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                      Comprar na Amazon
                    </a>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="bg-slate-900 text-slate-300 py-12 text-center md:text-left">
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start text-white font-bold text-xl mb-4">
              <BookOpen className="h-6 w-6" />
              WMS Masterclass
            </div>
            <p className="text-sm text-slate-400 max-w-xs mx-auto md:mx-0">
              O caminho definitivo para a supremacia na gestão de armazéns e logística eficiente.
            </p>
          </div>
          <div className="flex justify-center gap-6">
            <a
              href="https://www.linkedin.com/company/guia-masterclass-de-implementacao-wms/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Facebook
            </a>
            <a
              href="https://a.co/d/01x2227p"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Amazon
            </a>
          </div>
          <div className="md:text-right text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Eduardo Canal.
            <br /> Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-6 right-6 rounded-full shadow-elevation z-50 animate-fade-in-up"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
