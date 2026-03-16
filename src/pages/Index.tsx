import { Hero } from '@/components/sections/Hero'
import { AboutBook } from '@/components/sections/AboutBook'
import { CoreTopics } from '@/components/sections/CoreTopics'
import { Author } from '@/components/sections/Author'
import { Blog } from '@/components/sections/Blog'
import { Social } from '@/components/sections/Social'
import { FinalCTA } from '@/components/sections/FinalCTA'

export default function Index() {
  return (
    <div className="flex flex-col w-full">
      <Hero />
      <AboutBook />
      <CoreTopics />
      <Author />
      <Blog />
      <Social />
      <FinalCTA />
    </div>
  )
}
