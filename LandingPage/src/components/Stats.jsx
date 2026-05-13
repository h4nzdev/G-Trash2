import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const stats = [
  { value: 50,   suffix: '+',  label: 'Barangays Covered',  desc: 'Across Cebu City',        icon: '🏘️' },
  { value: 120,  suffix: '+',  label: 'Trucks Tracked',      desc: 'Real-time GPS',           icon: '🚛' },
  { value: 2400, suffix: '+',  label: 'Reports Resolved',    desc: 'And counting daily',      icon: '✅' },
  { value: 98,   suffix: '%',  label: 'System Uptime',       desc: 'Enterprise reliability',  icon: '⚡' },
]

const Stats = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stats-header', {
        opacity: 0, y: 50, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: '.stats-header', start: 'top 82%' },
      })

      const statEls = gsap.utils.toArray('.stat-number')

      gsap.from('.stat-card', {
        opacity: 0, y: 40, scale: 0.8, rotateY: 30,
        duration: 0.7, stagger: 0.1, ease: 'back.out(1.5)',
        scrollTrigger: {
          trigger: '.stats-grid',
          start: 'top 80%',
          onEnter: () => {
            stats.forEach((stat, i) => {
              const el = statEls[i]
              if (!el) return
              const obj = { val: 0 }
              gsap.to(obj, {
                val: stat.value,
                duration: 2.2,
                ease: 'power2.out',
                onUpdate: () => {
                  el.textContent =
                    Math.round(obj.val).toLocaleString() + stat.suffix
                },
              })
            })
          },
        },
      })

      // 3D Tilt for cards
      const cards = document.querySelectorAll('.stat-card')
      cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
          const { left, top, width, height } = card.getBoundingClientRect()
          const x = (e.clientX - left) / width - 0.5
          const y = (e.clientY - top) / height - 0.5
          
          gsap.to(card, {
            rotateY: x * 15,
            rotateX: -y * 15,
            transformPerspective: 800,
            duration: 0.4,
            ease: 'power2.out'
          })
        })
        
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.6,
            ease: 'power2.out'
          })
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="stats-header text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Trusted by communities <br />
            <span className="text-green-400">across Cebu</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-lg mx-auto">
            Real numbers reflecting real impact across barangays.
          </p>
        </div>

        <div className="stats-grid grid grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="stat-card bg-[#0d1f0d]/60 border border-green-900/35 rounded-2xl p-7 text-center hover:border-green-500/25 transition-colors"
            >
              <div className="text-3xl mb-3">{stat.icon}</div>
              <div className="stat-number text-4xl lg:text-5xl font-black text-green-400 mb-2">
                0{stat.suffix}
              </div>
              <div className="text-white font-semibold text-sm mb-1">{stat.label}</div>
              <div className="text-gray-500 text-xs">{stat.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Stats
