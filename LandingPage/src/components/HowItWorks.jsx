import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Wifi, Server, Cpu, Smartphone, CheckCircle2 } from 'lucide-react'

const steps = [
  {
    icon: Wifi,
    title: 'IoT Sensors Detect',
    desc: 'ESP32 microcontrollers with MQ-135 gas sensors continuously monitor ammonia and methane levels in garbage-prone areas around the clock.',
    color: 'blue',
    num: '01',
  },
  {
    icon: Server,
    title: 'Data Transmitted',
    desc: 'Sensor readings are sent via WiFi to the central Node.js backend in real-time, where they are stored and indexed in the database.',
    color: 'purple',
    num: '02',
  },
  {
    icon: Cpu,
    title: 'AI Analyzes Patterns',
    desc: 'The AI engine evaluates readings against safe thresholds, detects recurring patterns, and generates smart collection recommendations.',
    color: 'yellow',
    num: '03',
  },
  {
    icon: Smartphone,
    title: 'Users Notified',
    desc: 'Residents, officials, and collectors receive role-based real-time alerts through the mobile app based on proximity and urgency level.',
    color: 'green',
    num: '04',
  },
  {
    icon: CheckCircle2,
    title: 'Area Cleaned & Resolved',
    desc: 'Collectors respond, complete the cleanup, and mark the area as resolved. The heatmap updates to green — loop complete.',
    color: 'emerald',
    num: '05',
  },
]

const colorMap = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    icon: 'text-blue-400' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/25',  icon: 'text-purple-400' },
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/25',  icon: 'text-yellow-400' },
  green:   { bg: 'bg-green-500/10',   border: 'border-green-500/25',   icon: 'text-green-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: 'text-emerald-400' },
}

const HowItWorks = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hiw-header', {
        opacity: 0, y: 50, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: '.hiw-header', start: 'top 82%' },
      })

      gsap.from('.hiw-step', {
        opacity: 0, x: -50, rotateY: -20, duration: 0.7,
        stagger: 0.15, ease: 'power2.out',
        scrollTrigger: { trigger: '.hiw-steps', start: 'top 78%' },
      })

      gsap.from('.hiw-visual', {
        opacity: 0, x: 50, rotateY: 20, scale: 0.9, duration: 1,
        scrollTrigger: { trigger: '.hiw-steps', start: 'top 78%' },
      })

      gsap.from('.flow-bar', {
        scaleX: 0,
        duration: 1.5,
        stagger: 0.2,
        ease: 'power2.out',
        transformOrigin: 'left center',
        scrollTrigger: { trigger: '.hiw-visual', start: 'top 80%' },
      })

      // 3D Mouse track for the visual feed
      const visual = document.querySelector('.hiw-visual-card')
      if (visual) {
        window.addEventListener('mousemove', (e) => {
          const { clientX, clientY } = e
          const x = (clientX / window.innerWidth) - 0.5
          const y = (clientY / window.innerHeight) - 0.5
          
          gsap.to(visual, {
            rotateY: x * 10,
            rotateX: -y * 10,
            transformPerspective: 1000,
            duration: 1,
            ease: 'power1.out'
          })
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative py-28 px-6"
      style={{ background: 'linear-gradient(180deg, #060d06 0%, #0a1a0a 50%, #060d06 100%)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="hiw-header text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-5">
            <span className="text-green-400 text-sm font-semibold">How It Works</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black mb-5">
            From sensor to solution <br />
            <span className="text-green-400">in minutes</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            A fully automated pipeline from detection to resolution — no manual intervention needed.
          </p>
        </div>

        <div className="hiw-steps grid lg:grid-cols-2 gap-14 items-start">
          {/* Steps list */}
          <div className="space-y-0">
            {steps.map((step, i) => {
              const c = colorMap[step.color]
              const Icon = step.icon
              const isLast = i === steps.length - 1
              return (
                <div key={i} className="hiw-step flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className={`w-11 h-11 flex-shrink-0 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 min-h-[28px] mt-2 bg-green-900/30" />
                    )}
                  </div>

                  <div className="pb-7">
                    <div className="text-[10px] text-gray-600 font-mono font-semibold tracking-widest mb-1">
                      STEP {step.num}
                    </div>
                    <h3 className="text-white font-bold text-base mb-1.5">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live feed visual */}
          <div className="hiw-visual sticky top-28" style={{ perspective: '1200px' }}>
            <div className="hiw-visual-card bg-[#0d1f0d]/70 border border-green-900/35 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <span className="text-green-400 font-mono text-xs font-semibold tracking-widest uppercase">
                  Live Sensor Feed
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Broadcasting
                </span>
              </div>

              {[
                { label: 'Ammonia (NH₃)', val: 245, max: 300, color: 'bg-red-500',    text: 'text-red-400',    status: 'DANGER' },
                { label: 'Methane (CH₄)', val: 128, max: 300, color: 'bg-yellow-500', text: 'text-yellow-400', status: 'MODERATE' },
                { label: 'Air Quality Index', val: 72, max: 300, color: 'bg-green-500', text: 'text-green-400', status: 'SAFE' },
              ].map((item) => (
                <div key={item.label} className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${item.text}`}>{item.status}</span>
                      <span className="text-xs text-white font-semibold">{item.val}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-green-900/25 rounded-full overflow-hidden">
                    <div
                      className={`flow-bar h-full ${item.color} rounded-full`}
                      style={{ width: `${(item.val / item.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="mt-5 space-y-2.5">
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1 animate-pulse flex-shrink-0" />
                  <div>
                    <div className="text-xs text-red-400 font-semibold mb-0.5">⚠ Alert Triggered</div>
                    <div className="text-xs text-gray-400">
                      NH₃ exceeded 200 PPM at Sitio Punta. Truck T-01 dispatched.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/25 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-green-400 font-semibold mb-0.5">✓ Area Resolved</div>
                    <div className="text-xs text-gray-400">
                      Collection completed. Air quality normalized. Heatmap updated to green.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-green-900/30 flex items-center justify-between text-[10px] text-gray-600 font-mono">
                <span>SENSOR_ID: GT-BR-047</span>
                <span>PING: 0.3s ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
