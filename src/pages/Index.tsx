import { Hero } from '@/components/sections/Hero'
import { AboutBook } from '@/components/sections/AboutBook'
import { CoreTopics } from '@/components/sections/CoreTopics'
import { Author } from '@/components/sections/Author'
import { FAQ } from '@/components/sections/FAQ'
import { Blog } from '@/components/sections/Blog'
import { Social } from '@/components/sections/Social'
import { FinalCTA } from '@/components/sections/FinalCTA'

// COMANDO 3, ITEM 3 — limpeza da página pública.
//
// O QUE SAIU E POR QUÊ:
//
// 1. `<Testimonials />` — DEPOIMENTOS INVENTADOS. A seção mostrava frases de
//    pessoas que não disseram aquilo. Depoimento falso não é "conteúdo
//    provisório": é alegação de terceiro sem o consentimento dele, e no Brasil
//    é publicidade enganosa (CDC art. 37). O dono pediu para retirar e voltar só
//    quando tiver depoimentos reais.
//
// 2. `<Newsletter />` — formulário que NÃO ENVIA NADA. Quem digitava o e-mail
//    via "inscrito" e nunca recebia. Além de não entregar, coletava e-mail sem
//    base legal declarada e sem coleção onde guardar com aceite — o oposto do que
//    a própria plataforma faz no resto (aceite versionado no diagnóstico).
//    A alternativa era ligar numa coleção real com aceite explícito; sem isso,
//    o certo é sair do ar.
//
// PARA VOLTAR: depoimentos reais → recriar a seção com os textos autorizados.
// Newsletter → coleção `newsletter_inscricoes` com `aceite_em` e
// `aceite_texto_versao`, e um fluxo de confirmação por e-mail. Não basta
// readicionar o componente antigo.
export default function Index() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <AboutBook />
      <CoreTopics />
      <Author />
      <FAQ />
      <Blog />
      <Social />
      <FinalCTA />
    </div>
  )
}
