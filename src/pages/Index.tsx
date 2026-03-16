import { Hero } from '@/components/sections/Hero'
import { AboutBook } from '@/components/sections/AboutBook'
import { CoreTopics } from '@/components/sections/CoreTopics'
import { Testimonials } from '@/components/sections/Testimonials'
import { Author } from '@/components/sections/Author'
import { FAQ } from '@/components/sections/FAQ'
import { Newsletter } from '@/components/sections/Newsletter'
import { Blog } from '@/components/sections/Blog'
import { Social } from '@/components/sections/Social'
import { FinalCTA } from '@/components/sections/FinalCTA'

export default function Index() {
  return (
    <div className="flex flex-col w-full">
      <Hero />
      <AboutBook />
      <CoreTopics />
      <Testimonials />
      <Author />
      <FAQ />
      <Newsletter />
      <Blog />
      <Social />
      <FinalCTA />
    </div>
  )
}
