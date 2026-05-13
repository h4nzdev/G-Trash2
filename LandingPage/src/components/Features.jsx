import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Wifi, Bell, Brain, Truck, Map, BarChart3, Calendar, Leaf, ScanLine } from 'lucide-react'

const features = [
  {
    icon: Wifi,
    title: 'IoT Air Monitoring',
    desc: 'Detects ammonia, methane, and pollutants in real-time via ESP32 sensors installed in garbage-prone areas.',
    color: 'blue',
    tag: 'Hardware',
  },
  {
    icon: Bell,
    title: 'Smart 3-Layer Alerts',
    desc: 'Distance-based notifications: far for early notice, medium for preparation, and near for immediate action.',
    color: 'yellow',
    tag: 'Notifications',
  },
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    desc: 'Analyzes pollution patterns and recommends increasing collection frequency at high-risk time periods.',
    color: 'purple',
    tag: 'Intelligence',
  },
  {
    icon: Truck,
    title: 'Truck Tracking',
    desc: 'Real-time GPS location of garbage trucks with estimated arrival times displayed to residents.',
    color: 'green',
    tag: 'Logistics',
  },
  {
    icon: Map,
    title: 'Heatmap Visualization',
    desc: 'Map-based display: Red = High, Yellow = Moderate, Green = Safe. Instant situational awareness.',
    color: 'red',
    tag: 'Mapping',
  },
  {
    icon: BarChart3,
    title: 'Data Analytics',
    desc: 'Comprehensive pollution trends, most affected areas, and historical logs for data-driven decisions.',
    color: 'cyan',
    tag: 'Analytics',
  },
  {
    icon: Calendar,
    title: 'Collection Scheduling',
    desc: 'Interactive calendar showing garbage collection schedules per barangay with change alerts.',
    color: 'orange',
    tag: 'Planning',
  },
  {
    icon: Leaf,
    title: 'Segregation Guides',
    desc: 'Step-by-step waste segregation instructions to improve environmental awareness and compliance.',
    color: 'emerald',
    tag: 'Education',
  },
  {
    icon: ScanLine,
    title: 'AI Scanner',
    desc: 'Point your camera at trash — the AI identifies the item and suggests the correct disposal method.',
    color: 'pink',
    tag: 'AI Feature',
  },
]

const colorMap = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400',    tag: 'bg-blue-500/15 text-blue-400' },
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  icon: 'text-yellow-400',  tag: 'bg-yellow-500/15 text-yellow-400' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: 'text-purple-400',  tag: 'bg-purple-500/15 text-purple-400' },
  green:   { bg: 'bg-green-500/10',   border: 'border-green-500/20',   icon: 'text-green-400',   tag: 'bg-green-500/15 text-green-400' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: 'text-red-400',     tag: 'bg-red-500/15 text-red-400' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: 'text-cyan-400',    tag: 'bg-cyan-500/15 text-cyan-400' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: 'text-orange-400',  tag: 'bg-orange-500/15 text-orange-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', tag: 'bg-emerald-500/15 text-emerald-400' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    icon: 'text-pink-400',    tag: 'bg-pink-500/15 text-pink-400' },
}

const Features = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feat-header', {
        opacity: 0, y: 50, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: '.feat-header', start: 'top 82%' },
      })

      gsap.from('.feat-card', {
        opacity: 0, y: 60, duration: 0.7,
        stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: '.feat-grid', start: 'top 80%' },
      })

      // 3D Tilt for cards
      const cards = document.querySelectorAll('.feat-card')
      cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
          const { left, top, width, height } = card.getBoundingClientRect()
          const x = (e.clientX - left) / width - 0.5
          const y = (e.clientY - top) / height - 0.5
          
          gsap.to(card, {
            rotateY: x * 10,
            rotateX: -y * 10,
            transformPerspective: 600,
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
    <section ref={sectionRef} id="features" className="py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="feat-header text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-5">
            <span className="text-green-400 text-sm font-semibold">System Features</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black mb-5">
            Everything needed for <br />
            <span className="text-green-400">smart waste management</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            G-TRASH integrates IoT sensors, AI analytics, and real-time tracking
            into one seamless platform for all stakeholders.
          </p>
        </div>

        <div className="feat-grid grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, i) => {
            const c = colorMap[feat.color]
            const Icon = feat.icon
            return (
              <div
                key={i}
                className={`feat-card group relative ${c.bg} border ${c.border} rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-300 cursor-default`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.tag}`}>
                    {feat.tag}
                  </span>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{feat.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Features
