import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Stats from './components/Stats'
import Roles from './components/Roles'
import Download from './components/Download'
import CTA from './components/CTA'
import Footer from './components/Footer'

gsap.registerPlugin(ScrollTrigger)

function App() {
  return (
    <div className="bg-[#060d06] text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <Roles />
      <Download />
      <CTA />
      <Footer />
    </div>
  )
}

export default App
