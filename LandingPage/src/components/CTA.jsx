import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Smartphone, Globe } from 'lucide-react'

const CTA = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.cta-box', {
        opacity: 0, y: 70, scale: 0.8, rotateX: -20, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.cta-box', start: 'top 82%' },
      })

      // Animate the floating badges
      gsap.from('.cta-badge', {
        opacity: 0, scale: 0.7, z: 50, duration: 0.6,
        stagger: 0.15, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: '.cta-box', start: 'top 78%' },
      })

      // Float the decorative orbs in 3D
      gsap.to('.cta-orb-1', {
        y: -30, x: 20, z: 50, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut',
      })
      gsap.to('.cta-orb-2', {
        y: 20, x: -20, z: -50, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut',
      })

      // 3D Tilt for the main CTA box
      const box = document.querySelector('.cta-box')
      if (box) {
        box.addEventListener('mousemove', (e) => {
          const { left, top, width, height } = box.getBoundingClientRect()
          const x = (e.clientX - left) / width - 0.5
          const y = (e.clientY - top) / height - 0.5
          
          gsap.to(box, {
            rotateY: x * 8,
            rotateX: -y * 8,
            transformPerspective: 1200,
            duration: 0.5,
            ease: 'power2.out'
          })
        })
        
        box.addEventListener('mouseleave', () => {
          gsap.to(box, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.8,
            ease: 'power2.out'
          })
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="about" className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="cta-box relative rounded-3xl overflow-hidden border border-green-500/25 p-12 lg:p-16 text-center">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-950/60 via-[#060d06] to-emerald-950/40" />

          {/* Decorative orbs */}
          <div className="cta-orb-1 absolute -top-20 -left-20 w-72 h-72 bg-green-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="cta-orb-2 absolute -bottom-20 -right-20 w-56 h-56 bg-emerald-400/6 rounded-full blur-3xl pointer-events-none" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative">
            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="cta-badge flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-full px-3 py-1.5">
                <Smartphone className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 text-xs font-semibold">Mobile App</span>
              </div>
              <div className="cta-badge flex items-center gap-2 bg-blue-500/15 border border-blue-500/30 rounded-full px-3 py-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-semibold">Web Platform</span>
              </div>
              <div className="cta-badge flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 rounded-full px-3 py-1.5">
                <span className="text-purple-400 text-xs font-semibold">🤖 AI-Powered</span>
              </div>
            </div>

            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-black mb-5 leading-[1.05]">
              Ready to make Cebu <br />
              <span className="text-green-400">cleaner?</span>
            </h2>

            <p className="text-gray-400 text-lg lg:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of residents, officials, and collectors already using G-TRASH
              to build a smarter, healthier community.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <button className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-xl flex items-center gap-2 transition-all hover:scale-105 shadow-xl shadow-green-500/20">
                Download the App <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-white/8 hover:bg-white/14 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-all">
                View Documentation
              </button>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-gray-600">
              <span>✓ Free for residents</span>
              <span>✓ No credit card required</span>
              <span>✓ Available in Visayan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTA
