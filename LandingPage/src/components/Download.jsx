import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Smartphone, Truck, Download as DownloadIcon, QrCode, ArrowUpRight } from 'lucide-react'

const apps = [
  {
    id: 'resident',
    icon: Smartphone,
    color: 'green',
    label: 'Resident App',
    subtitle: 'For Community Members',
    description:
      'View real-time heatmaps, track garbage trucks, submit issue reports, and receive smart pollution alerts — all in one app.',
    features: ['Live Heatmap', 'Truck Tracking', 'AI Scanner', '3-Layer Alerts'],
    link: 'https://expo.dev/accounts/medora/projects/G-Trash/builds/3da6c745-2525-45de-bf33-d02c87d0f3ba',
    badge: 'v1.0 · Android APK',
  },
  {
    id: 'truck',
    icon: Truck,
    color: 'blue',
    label: 'Garbage Truck App',
    subtitle: 'For Collection Crews',
    description:
      'View optimized routes, monitor urgency heatmaps, receive dispatch orders, and mark areas as resolved — built for crews on the move.',
    features: ['Route Optimizer', 'Zone Heatmap', 'Dispatch Orders', 'Area Tracking'],
    link: 'https://expo.dev/accounts/h4nz.dev/projects/G-Trash/builds/724b9b6a-5a5f-49f4-96dd-cf2980701b59',
    badge: 'v1.0 · Android APK',
  },
]

const colorMap = {
  green: {
    glow:   'shadow-green-500/15',
    border: 'border-green-500/25',
    iconBg: 'bg-green-500/10 border-green-500/30',
    icon:   'text-green-400',
    tag:    'bg-green-500/15 text-green-400 border-green-500/25',
    dot:    'bg-green-400',
    btn:    'bg-green-500 hover:bg-green-400 shadow-green-500/25',
    orb:    'bg-green-500/6',
  },
  blue: {
    glow:   'shadow-blue-500/15',
    border: 'border-blue-500/25',
    iconBg: 'bg-blue-500/10 border-blue-500/30',
    icon:   'text-blue-400',
    tag:    'bg-blue-500/15 text-blue-400 border-blue-500/25',
    dot:    'bg-blue-400',
    btn:    'bg-blue-500 hover:bg-blue-400 shadow-blue-500/25',
    orb:    'bg-blue-500/6',
  },
}

const Download = () => {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.dl-header', {
        opacity: 0, y: 50, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: '.dl-header', start: 'top 82%' },
      })

      gsap.from('.dl-card', {
        opacity: 0, y: 70, scale: 0.9, rotateX: -10, duration: 0.8,
        stagger: 0.18, ease: 'power3.out',
        scrollTrigger: { trigger: '.dl-grid', start: 'top 78%' },
      })

      gsap.from('.dl-feat-tag', {
        opacity: 0, x: -12, duration: 0.5,
        stagger: 0.06, ease: 'power2.out',
        scrollTrigger: { trigger: '.dl-grid', start: 'top 72%' },
      })

      // Subtle floating animation on the phone mockups
      gsap.to('.dl-mock', {
        y: -8, duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 1.5,
      })

      // 3D Tilt for cards
      const cards = document.querySelectorAll('.dl-card')
      cards.forEach(card => {
        const mock = card.querySelector('.dl-mock')
        card.addEventListener('mousemove', (e) => {
          const { left, top, width, height } = card.getBoundingClientRect()
          const x = (e.clientX - left) / width - 0.5
          const y = (e.clientY - top) / height - 0.5
          
          gsap.to(card, {
            rotateY: x * 15,
            rotateX: -y * 15,
            transformPerspective: 1000,
            duration: 0.4,
            ease: 'power2.out'
          })

          if (mock) {
            gsap.to(mock, {
              x: x * 40,
              y: y * 40,
              duration: 0.5,
              ease: 'power2.out'
            })
          }
        })
        
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.6,
            ease: 'power2.out'
          })
          if (mock) {
            gsap.to(mock, {
              x: 0,
              y: 0,
              duration: 0.6,
              ease: 'power2.out'
            })
          }
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="download" className="py-28 px-6 relative overflow-hidden">
      {/* Background ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-green-500/4 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-blue-500/4 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="dl-header text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-5">
            <DownloadIcon className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400 text-sm font-semibold">Download Apps</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black mb-5">
            Install G-TRASH on <br />
            <span className="text-green-400">your device</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Two purpose-built Android apps — one for residents and one for collection crews.
            Scan the QR or tap the button to install directly from Expo.
          </p>
        </div>

        {/* App cards */}
        <div className="dl-grid grid md:grid-cols-2 gap-7 max-w-4xl mx-auto">
          {apps.map((app) => {
            const c = colorMap[app.color]
            const Icon = app.icon
            return (
              <div
                key={app.id}
                className={`dl-card relative bg-[#0d1f0d]/70 border ${c.border} rounded-3xl p-8 shadow-2xl ${c.glow} hover:scale-[1.015] transition-transform duration-300 overflow-hidden`}
              >
                {/* Decorative orb */}
                <div className={`absolute -top-16 -right-16 w-52 h-52 ${c.orb} rounded-full blur-3xl pointer-events-none`} />

                {/* Phone mockup strip */}
                <div className={`dl-mock relative mx-auto mb-7 w-16 h-16 border ${c.iconBg} rounded-2xl flex items-center justify-center shadow-xl`}>
                  <Icon className={`w-8 h-8 ${c.icon}`} />
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[10px] font-semibold border px-2.5 py-1 rounded-full ${c.tag}`}>
                    {app.badge}
                  </span>
                </div>

                <h3 className="text-white font-black text-2xl leading-tight mb-1">{app.label}</h3>
                <p className={`text-xs font-semibold mb-4 ${c.icon}`}>{app.subtitle}</p>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">{app.description}</p>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {app.features.map((feat) => (
                    <span
                      key={feat}
                      className={`dl-feat-tag text-[11px] font-medium border px-2.5 py-1 rounded-full ${c.tag}`}
                    >
                      {feat}
                    </span>
                  ))}
                </div>

                {/* QR hint row */}
                <div className="flex items-center gap-3 mb-5 p-3 bg-white/4 border border-white/8 rounded-xl">
                  <QrCode className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-500 text-xs leading-snug">
                    Open the link below on your Android device to install the APK directly from Expo.
                  </span>
                </div>

                {/* CTA button */}
                <a
                  href={app.link}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-center gap-2 w-full text-black font-bold py-3.5 rounded-xl transition-all hover:scale-[1.03] shadow-lg ${c.btn}`}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Install {app.label}
                  <ArrowUpRight className="w-4 h-4 opacity-70" />
                </a>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-gray-600 text-xs mt-10">
          Requires Android · Tap "Install" on the Expo build page · No Google Play needed
        </p>
      </div>
    </section>
  )
}

export default Download
