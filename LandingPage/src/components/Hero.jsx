import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowRight, Play } from 'lucide-react'

const Hero = () => {
  const heroRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 1 })

      tl.from('.hero-badge', {
        opacity: 0, y: -20, duration: 0.7, ease: 'back.out(1.7)',
      })
        .from('.hero-word', {
          opacity: 0, y: 80, duration: 0.85,
          stagger: 0.07, ease: 'power3.out',
        }, '-=0.3')
        .from('.hero-subtitle', {
          opacity: 0, y: 30, duration: 0.7, ease: 'power2.out',
        }, '-=0.5')
        .from('.hero-btn', {
          opacity: 0, y: 20, duration: 0.5,
          stagger: 0.1, ease: 'power2.out',
        }, '-=0.4')
        .from('.hero-stat-item', {
          opacity: 0, y: 20, duration: 0.5,
          stagger: 0.1, ease: 'power2.out',
        }, '-=0.3')
        .from('.hero-visual', {
          opacity: 0, x: 60, scale: 0.9, duration: 1.1, ease: 'power3.out',
        }, '-=1.4')
        .from('.hero-notif', {
          opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(2)',
        }, '-=0.3')
        .from('.hero-truck-card', {
          opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(2)',
        }, '-=0.2')

      // Parallax background
      gsap.to('.hero-bg-blob', {
        y: (i) => (i === 0 ? 50 : -50),
        duration: 3,
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      })

      // 3D Tilt Effect
      const visual = document.querySelector('.hero-visual-inner')
      if (visual) {
        const handleMouseMove = (e) => {
          const { clientX, clientY } = e
          const { left, top, width, height } = visual.getBoundingClientRect()
          const x = (clientX - left) / width - 0.5
          const y = (clientY - top) / height - 0.5
          
          gsap.to(visual, {
            rotateY: x * 15,
            rotateX: -y * 15,
            transformPerspective: 1000,
            duration: 0.5,
            ease: 'power2.out'
          })

          gsap.to('.hero-notif', {
            x: x * 30,
            y: y * 30,
            duration: 0.6,
            ease: 'power2.out'
          })

          gsap.to('.hero-truck-card', {
            x: -x * 20,
            y: -y * 20,
            duration: 0.6,
            ease: 'power2.out'
          })
        }

        const handleMouseLeave = () => {
          gsap.to([visual, '.hero-notif', '.hero-truck-card'], {
            rotateX: 0,
            rotateY: 0,
            x: 0,
            y: 0,
            duration: 1,
            ease: 'power2.out'
          })
        }

        heroRef.current.addEventListener('mousemove', handleMouseMove)
        heroRef.current.addEventListener('mouseleave', handleMouseLeave)
      }

      gsap.to('.float-node', {
        y: -12, duration: 2.5, repeat: -1, yoyo: true,
        ease: 'sine.inOut', stagger: { each: 0.5, from: 'random' },
      })

      gsap.to('.pulse-ring', {
        scale: 2.8, opacity: 0, duration: 2, repeat: -1,
        ease: 'power1.out', stagger: { each: 0.7, from: 'random' },
      })

      gsap.to('.truck-dot', {
        x: 30, duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut',
      })

      gsap.to('.data-bar', {
        scaleX: 1, duration: 1.5, ease: 'power2.out',
        stagger: 0.2, delay: 2,
        transformOrigin: 'left center',
      })
    }, heroRef)

    return () => ctx.revert()
  }, [])

  const titleWords = ['Smart', 'Waste', 'Monitoring', 'for', 'a', 'Cleaner', 'Cebu']

  return (
    <section
      ref={heroRef}
      id="home"
      className="relative min-h-screen flex items-center pt-24 pb-16 px-6 overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="hero-bg-blob absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-green-500/8 rounded-full blur-3xl" />
        <div className="hero-bg-blob absolute bottom-1/4 right-1/3 w-72 h-72 bg-emerald-400/5 rounded-full blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <div className="hero-badge inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-semibold">IoT + AI Powered · Cebu, PH</span>
          </div>

          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] mb-6">
            {titleWords.map((word, i) => (
              <span
                key={i}
                className="hero-word inline-block mr-[0.25em] mb-1"
              >
                {word === 'Smart' || word === 'Cleaner' ? (
                  <span className="text-green-400">{word}</span>
                ) : (
                  word
                )}
              </span>
            ))}
          </h1>

          <p className="hero-subtitle text-gray-400 text-lg lg:text-xl leading-relaxed mb-10 max-w-lg">
            Real-time pollution detection, AI-powered analysis, and garbage truck tracking
            — built for smarter, healthier communities.
          </p>

          <div className="flex flex-wrap gap-4 mb-14">
            <button className="hero-btn bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3.5 rounded-xl flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-green-500/20">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </button>
            <button className="hero-btn border border-green-900 hover:border-green-500/40 text-white font-medium px-7 py-3.5 rounded-xl flex items-center gap-2 transition-all hover:bg-green-900/10">
              <Play className="w-4 h-4 text-green-400" /> Watch Demo
            </button>
          </div>

          <div className="flex flex-wrap gap-10">
            {[
              { value: '50+', label: 'Barangays' },
              { value: '120+', label: 'Trucks Tracked' },
              { value: '2,400+', label: 'Reports Resolved' },
            ].map((s) => (
              <div key={s.label} className="hero-stat-item">
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Dashboard mockup */}
        <div className="hero-visual relative" style={{ perspective: '1000px' }}>
          <div className="hero-visual-inner relative bg-[#0d1f0d]/80 border border-green-900/40 rounded-2xl p-5 backdrop-blur-sm shadow-2xl shadow-black/40">
            {/* Chrome bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex items-center gap-2 bg-[#0a180a] border border-green-900/40 rounded-md px-3 py-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500 font-mono">G-TRASH Live Dashboard</span>
              </div>
            </div>

            {/* Map area */}
            <div className="relative bg-[#071007] rounded-xl h-52 overflow-hidden mb-4 border border-green-900/30">
              {/* Grid */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(34,197,94,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.08) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Heatmap blob — red */}
              <div className="absolute" style={{ top: '18%', left: '18%' }}>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(239,68,68,0.45) 0%, rgba(239,68,68,0.12) 50%, transparent 72%)',
                  }}
                />
                <div className="float-node relative w-9 h-9 -translate-x-1/2 -translate-y-1/2">
                  <div className="pulse-ring absolute inset-0 rounded-full bg-red-500/35" />
                  <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-400/60 flex items-center justify-center">
                    <span className="text-red-300 text-[10px] font-bold">HIGH</span>
                  </div>
                </div>
              </div>

              {/* Heatmap blob — yellow */}
              <div className="absolute" style={{ top: '52%', left: '55%' }}>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(234,179,8,0.35) 0%, rgba(234,179,8,0.08) 50%, transparent 72%)',
                  }}
                />
                <div className="float-node relative w-8 h-8 -translate-x-1/2 -translate-y-1/2">
                  <div className="pulse-ring absolute inset-0 rounded-full bg-yellow-500/30" />
                  <div className="w-8 h-8 rounded-full bg-yellow-500/15 border border-yellow-400/50 flex items-center justify-center">
                    <span className="text-yellow-300 text-[9px] font-bold">MED</span>
                  </div>
                </div>
              </div>

              {/* Heatmap blob — green */}
              <div className="absolute" style={{ top: '68%', left: '22%' }}>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(34,197,94,0.3) 0%, rgba(34,197,94,0.06) 50%, transparent 72%)',
                  }}
                />
                <div className="float-node relative w-7 h-7 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-400/50 flex items-center justify-center">
                    <span className="text-green-300 text-[9px] font-bold">OK</span>
                  </div>
                </div>
              </div>

              {/* Truck */}
              <div className="truck-dot absolute" style={{ top: '38%', left: '36%' }}>
                <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/40 rounded-md px-2 py-1 whitespace-nowrap">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  <span className="text-blue-300 text-[10px] font-semibold">🚛 T-01</span>
                </div>
              </div>

              {/* Route path dots */}
              {[
                { top: '42%', left: '42%' },
                { top: '44%', left: '50%' },
                { top: '46%', left: '58%' },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-blue-400/50 rounded-full"
                  style={pos}
                />
              ))}
            </div>

            {/* Sensor cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <div className="text-red-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">NH₃</div>
                <div className="text-white font-black text-xl">245</div>
                <div className="text-red-400 text-[10px] mt-1">PPM · High ↑</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <div className="text-yellow-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">CH₄</div>
                <div className="text-white font-black text-xl">128</div>
                <div className="text-yellow-400 text-[10px] mt-1">PPM · Med →</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <div className="text-green-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">AQI</div>
                <div className="text-white font-black text-xl">72</div>
                <div className="text-green-400 text-[10px] mt-1">Safe · ↓</div>
              </div>
            </div>
          </div>

          {/* Floating alert */}
          <div className="hero-notif absolute -top-5 -right-5 bg-[#0d1f0d] border border-red-500/30 rounded-xl p-3 shadow-xl max-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
              <span className="text-white text-xs font-semibold leading-tight">
                Alert: High NH₃ Detected
              </span>
            </div>
            <div className="text-gray-500 text-[10px]">Brgy. Lahug · 2m ago</div>
          </div>

          {/* Floating truck ETA card */}
          <div className="hero-truck-card absolute -bottom-5 -left-5 bg-[#0d1f0d] border border-blue-500/30 rounded-xl p-3 shadow-xl">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚛</span>
              <div>
                <div className="text-white text-xs font-semibold">Truck T-01</div>
                <div className="text-green-400 text-xs font-medium">ETA: 8 min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-gray-600 text-xs font-medium tracking-widest uppercase">Scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-green-800/60 to-transparent animate-pulse" />
      </div>
    </section>
  )
}

export default Hero
