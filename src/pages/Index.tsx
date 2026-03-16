import { Hero } from '@/components/sections/Hero'
import { AboutBook } from '@/components/sections/AboutBook'
import { CoreTopics } from '@/components/sections/CoreTopics'
import { Author } from '@/components/sections/Author'
import { Social } from '@/components/sections/Social'
import { FinalCTA } from '@/components/sections/FinalCTA'

const Index = () => {
  return (
    <div className="flex flex-col w-full overflow-hidden">
      <Hero />
      <AboutBook />
      <CoreTopics />
      <Author />
      <Social />
      <FinalCTA />
    </div>
  )
}

export default Index
