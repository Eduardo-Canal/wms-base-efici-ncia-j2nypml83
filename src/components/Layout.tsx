import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookOpen, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '#about', label: 'Sobre o Livro' },
    { href: '#topics', label: 'Tópicos Principais' },
    { href: '#author', label: 'O Autor' },
    { href: '#blog', label: 'Blog' },
    { href: '#contact', label: 'Contato' },
  ]

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">WMS Masterclass</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-primary text-muted-foreground"
              >
                {link.label}
              </a>
            ))}
            <Button size="sm" asChild>
              <a href="https://a.co/d/01x2227p" target="_blank" rel="noopener noreferrer">
                Comprar
              </a>
            </Button>
          </nav>

          {/* Mobile Navigation */}
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
                    onClick={handleLinkClick}
                  >
                    <BookOpen className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">WMS Masterclass</span>
                  </Link>
                  <nav className="flex flex-col space-y-4">
                    {navLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="text-base font-medium transition-colors hover:text-primary"
                        onClick={handleLinkClick}
                      >
                        {link.label}
                      </a>
                    ))}
                    <div className="pt-4 border-t">
                      <Button className="w-full" asChild onClick={handleLinkClick}>
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
            <div className="flex space-x-4 text-sm text-muted-foreground">
              <a href="#about" className="hover:underline hover:text-primary">
                Sobre
              </a>
              <a href="#contact" className="hover:underline hover:text-primary">
                Contato
              </a>
              <a href="#blog" className="hover:underline hover:text-primary">
                Blog
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
