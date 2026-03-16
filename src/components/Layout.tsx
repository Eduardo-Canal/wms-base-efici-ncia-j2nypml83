import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookOpen, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState, useEffect } from 'react'

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    if (isHome && location.hash) {
      setTimeout(() => {
        const element = document.querySelector(location.hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    }
  }, [location, isHome])

  const navLinks = [
    { id: '#about', label: 'Sobre o Livro' },
    { id: '#conteudo', label: 'Tópicos' },
    { id: '#depoimentos', label: 'Depoimentos' },
    { id: '#faq', label: 'FAQ' },
    { id: '/blog', label: 'Blog' },
  ]

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    setIsMobileMenuOpen(false)
    if (id.startsWith('/')) {
      return
    }
    if (isHome) {
      e.preventDefault()
      const element = document.querySelector(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
        window.history.pushState(null, '', id)
      }
    }
  }

  const renderNavLinks = (className: string) => (
    <>
      {navLinks.map((link) =>
        link.id.startsWith('/') ? (
          <Link
            key={link.id}
            to={link.id}
            className={className}
            onClick={(e) => handleLinkClick(e as any, link.id)}
          >
            {link.label}
          </Link>
        ) : (
          <a
            key={link.id}
            href={isHome ? link.id : `/${link.id}`}
            className={className}
            onClick={(e) => handleLinkClick(e, link.id)}
          >
            {link.label}
          </a>
        ),
      )}
    </>
  )

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">WMS Masterclass</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {renderNavLinks('transition-colors hover:text-primary text-muted-foreground')}
            <Button size="sm" asChild>
              <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                Comprar na Amazon
              </a>
            </Button>
          </nav>

          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="flex flex-col space-y-6 mt-6">
                  <Link
                    to="/"
                    className="flex items-center space-x-2 mb-4"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <BookOpen className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">WMS Masterclass</span>
                  </Link>
                  <nav className="flex flex-col space-y-4">
                    {renderNavLinks('text-base font-medium transition-colors hover:text-primary')}
                    <div className="pt-4 border-t">
                      <Button className="w-full" asChild onClick={() => setIsMobileMenuOpen(false)}>
                        <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                          Comprar na Amazon
                        </a>
                      </Button>
                    </div>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-muted/40 py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">WMS Masterclass</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Eduardo Canal. Todos os direitos reservados.
            </p>
            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a
                href={isHome ? '#about' : '/#about'}
                className="hover:underline hover:text-primary"
              >
                Sobre
              </a>
              <a href={isHome ? '#faq' : '/#faq'} className="hover:underline hover:text-primary">
                FAQ
              </a>
              <Link to="/blog" className="hover:underline hover:text-primary">
                Blog
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
