import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import NotFound from './pages/NotFound'
import { Layout } from './components/Layout'

// Área de cursos (EAD) — mesma origem, autenticação obrigatória nas aulas.
import Catalogo from './ead/telas/Catalogo'
import Curso from './ead/telas/Curso'
import Player from './ead/telas/Player'
import Entrar from './ead/telas/Entrar'
import Comprar from './ead/telas/Comprar'
import Obrigado from './ead/telas/Obrigado'
import MinhaArea from './ead/telas/MinhaArea'
import Admin from './ead/telas/Admin'
import ResetSenha from './ead/telas/ResetSenha'
import Voucher from './ead/telas/Voucher'
import Certificado from './ead/telas/Certificado'
// LOTE 2 — fluxo do presente
import Convite from './ead/telas/Convite'
import Diagnostico from './ead/telas/Diagnostico'
import Conclusao from './ead/telas/Conclusao'
import Impressao from './ead/telas/Impressao'
import { useSessao } from './ead/useSessao'

const EadRoutes = () => {
  const { logado } = useSessao()
  return (
    <>
      <Route path="/ead" element={<Catalogo logado={logado} />} />
      <Route
        path="/ead/entrar"
        element={<Entrar onEntrou={() => window.dispatchEvent(new Event('ead:sessao'))} />}
      />
      {/* fora de /ead de propósito: o link do e-mail aponta para /reset-password
          e precisa funcionar mesmo com a área de cursos fechada */}
      <Route path="/reset-password" element={<ResetSenha />} />
      <Route path="/ead/minha-area" element={<MinhaArea logado={logado} />} />
      <Route path="/ead/voucher" element={<Voucher />} />
      <Route path="/certificado/:codigo" element={<Certificado />} />
      {/* só admin: a tela esconde, mas quem barra é o servidor */}
      <Route path="/ead/admin" element={<Admin />} />
      <Route path="/ead/comprar" element={<Comprar />} />
      <Route path="/ead/obrigado" element={<Obrigado />} />
      <Route path="/ead/aula/:slug" element={<Player />} />

      {/* LOTE 2 — fluxo do presente. As rotas específicas vêm ANTES de
          /ead/:cursoSlug, senão o parâmetro capturaria "diagnostico" e
          "conclusao" como se fossem nomes de curso. */}
      <Route path="/ead/:cursoSlug/diagnostico" element={<Diagnostico />} />
      <Route path="/ead/:cursoSlug/conclusao" element={<Conclusao />} />
      <Route path="/ead/imprimir/:tipo/:chave" element={<Impressao />} />

      {/* o curso é o último: /ead/:cursoSlug capturaria as rotas acima */}
      <Route path="/ead/:cursoSlug" element={<Curso />} />
    </>
  )
}

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {EadRoutes()}
        </Route>
        {/* Convite é PÚBLICO e fica FORA do Layout: quem recebe o link não deve
            ver o menu do site por cima da proposta do presente. */}
        <Route path="/presente/:codigo" element={<Convite />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
