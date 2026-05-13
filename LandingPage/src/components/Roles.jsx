import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Home, Truck, Building2, ShieldCheck } from 'lucide-react'

const roles = [
  {
    icon: Home,
    title: 'Residents',
    subtitle: 'Community Members',
    color: 'green',
    features: [
      'View real-time heatmap',
      'Track garbage trucks live',
      'Submit issue reports',
      'Receive 3-layer alerts',
      'Collection schedule calendar',
      'AI scanner for trash items',
      'Segregation instructions',
    ],
  },
  {
    icon: Truck,
    title: 'Collectors',
    subtitle: 'Garbage Truck Crews',
    color: 'blue',
    features: [
      'View heatmap & urgency',
      'Access optimized routes',
      'See assigned pickup areas',
      'Identify high-risk zones',
      'Mark areas as cleaned',
      'Receive dispatch orders',
      'Track route progress',
    ],
  },
  {
    icon: Building2,
    title: 'Officials',
    subtitle: 'Barangay & Government',
    color: 'yellow',
    features: [
      'View reports & analytics',
      'Monitor urgency levels',
      'Full analytics dashboard',
      'Evaluate performance',
      'Barangay leaderboard',
      'Manage schedules',
      'Export data reports',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Admins',
    subtitle: 'System Developers',
    color: 'purple',
    features: [
      'Monitor all metrics',
      'View heatmap overview',
      'Track all deployed trucks',
      'Manage bug reports',
      'Handle notifications',
      'Manage user accounts',
      'System configuration',
    ],
  },
]

const colorMap = {
  green:  { border: 'border-green-500/20',  iconBg: 'bg-green-500/10 border-green-500/30',  icon: 'text-green-400',  dot: 'bg-green-400',  badge: 'bg-green-500/15 text-green-400 border-green-500/20' },
  blue:   { border: 'border-blue-500/20',   iconBg: 'bg-blue-500/10 border-blue-500/30',   icon: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  yellow: { border: 'border-yellow-500/20', iconBg: 'bg-yellow-500/10 border-yellow-500/30', icon: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  purple: { border: 'border-purple-500/20', iconBg: 'bg-purple-500/10 border-purple-500/30', icon: 'text-purple-400', dot: 'bg-purple-400', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
}

const Roles = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.roles-header', {
        opacity: 0, y: 50, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: '.roles-header', start: 'top 82%' },
      })

      gsap.from('.role-card', {
        opacity: 0, y: 60, rotateX: -15, duration: 0.7,
        stagger: 0.12, ease: 'power2.out',
        scrollTrigger: { trigger: '.roles-grid', start: 'top 80%' },
      })

      // 3D Tilt for cards
      const cards = document.querySelectorAll('.role-card')
      cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
          const { left, top, width, height } = card.getBoundingClientRect()
          const x = (e.clientX - left) / width - 0.5
          const y = (e.clientY - top) / height - 0.5
          
          gsap.to(card, {
            rotateY: x * 12,
            rotateX: -y * 12,
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
    <section ref={sectionRef} id="roles" className="py-28 px-6 bg-[#070f07]/40">
      <div className="max-w-7xl mx-auto">
        <div className="roles-header text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-5">
            <span className="text-green-400 text-sm font-semibold">Role-Based Access</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black mb-5">
            Built for every <br />
            <span className="text-green-400">stakeholder</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            From residents to administrators, everyone gets the right tools
            for their specific role in the waste management ecosystem.
          </p>
        </div>

        <div className="roles-grid grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((role, i) => {
            const c = colorMap[role.color]
            const Icon = role.icon
            return (
              <div
                key={i}
                className={`role-card bg-[#0d1f0d]/60 border ${c.border} rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-300`}
              >
                <div className={`w-12 h-12 border ${c.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${c.icon}`} />
                </div>

                <h3 className="text-white font-bold text-lg leading-tight">{role.title}</h3>
                <div className={`inline-block text-[10px] font-semibold border px-2 py-0.5 rounded-full mt-1 mb-4 ${c.badge}`}>
                  {role.subtitle}
                </div>

                <ul className="space-y-2">
                  {role.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className={`mt-[5px] w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Roles
