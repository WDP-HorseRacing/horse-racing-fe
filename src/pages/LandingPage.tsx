import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/store';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Activity, BarChart3, Shield, Flag, ChevronDown, ArrowRight } from 'lucide-react';
import { useGsapReveal, useGsapCounter } from '../hooks/useGsapReveal';

gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const featuresRef = useGsapReveal({ stagger: 0.15, distance: 50 });
  const statsRef = useGsapReveal({ direction: 'up', stagger: 0.12 });

  // Counter refs
  const counter1 = useGsapCounter(1247);
  const counter2 = useGsapCounter(342);
  const counter3 = useGsapCounter(98);

  useEffect(() => {
    if (!titleRef.current || !heroRef.current) return;

    const tl = gsap.timeline({ delay: 0.3 });

    // Split title characters for stagger
    const title = titleRef.current;
    const text = title.textContent || '';
    title.textContent = '';
    const chars = text.split('').map(char => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      title.appendChild(span);
      return span;
    });

    tl.to(chars, {
      opacity: 1,
      y: 0,
      duration: 0.05,
      stagger: 0.04,
      ease: 'power2.out',
    });

    // Fade in subtitle + buttons
    tl.fromTo(
      heroRef.current.querySelectorAll('[data-hero-reveal]'),
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' },
      '-=0.3'
    );

    // Scroll indicator bounce
    tl.fromTo(
      heroRef.current.querySelector('[data-scroll-indicator]'),
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
      '-=0.2'
    );

    return () => { tl.kill(); };
  }, []);

  const features = [
    {
      icon: Shield,
      title: 'Horse profiles & pedigree',
      desc: 'Complete identity management with 4-generation bloodline tracking, microchip records, and ownership syndicate allocation.',
      span: 'col-span-2',
    },
    {
      icon: Activity,
      title: 'Live training monitor',
      desc: 'Real-time heart rate, speed tracking, and automated danger zone alerts during sessions.',
      span: 'col-span-1',
    },
    {
      icon: BarChart3,
      title: 'Training plans & nutrition',
      desc: 'Dynamic feeding plans auto-adjust based on workload intensity and distance parameters.',
      span: 'col-span-1',
    },
    {
      icon: Flag,
      title: 'Race registration',
      desc: 'Aptitude-distance matching, race readiness checks, and registration workflow with override audit.',
      span: 'col-span-2',
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* ===== HERO SECTION ===== */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="/16042528_3840_2160_24fps.mp4"
            type="video/mp4"
          />
        </video>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-white" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-transparent" />

        {/* Noise texture */}
        <div className="absolute inset-0 noise-overlay pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto mt-[-5vh]">
          {/* Nav bar on hero */}
          <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5" data-hero-reveal>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md">
                <Flag size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">HorseRacing</span>
            </div>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="px-5 py-2 rounded-xl bg-white/15 backdrop-blur-md text-white text-sm font-medium border border-white/20 hover:bg-white/25 transition-all duration-300"
            >
              {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
            </Link>
          </nav>

          <h1
            ref={titleRef}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-white leading-[0.95] mb-6"
          >
            HorseRacing
          </h1>

          <p
            className="text-lg sm:text-xl text-white/80 font-light max-w-2xl mx-auto mb-10 leading-relaxed"
            data-hero-reveal
          >
            Professional equine training management for race clubs.
            Track performance, plan nutrition, monitor live sessions,
            and register for races — all in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" data-hero-reveal>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="group px-8 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-500 transition-all duration-300 shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              {isAuthenticated ? 'Go to dashboard' : 'Get started'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm text-white font-medium text-base border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              Explore features
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2" data-scroll-indicator>
          <span className="text-xs text-white/50 tracking-widest font-light">scroll</span>
          <ChevronDown size={20} className="text-white/50 animate-bounce" />
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" className="py-24 sm:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-xl" ref={featuresRef}>
            <p className="text-sm font-semibold text-emerald-600 tracking-wide mb-3" data-reveal>
              Built for race clubs
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4" data-reveal>
              Everything you need to manage elite equines
            </h2>
            <p className="text-lg text-gray-500 font-light leading-relaxed" data-reveal>
              From daily stable checks to race day registration. A single
              platform designed around the workflows trainers, managers,
              and owners actually use.
            </p>
          </div>

          {/* Bento Grid — Asymmetric */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5" ref={featuresRef}>
            {features.map((f, i) => (
              <div
                key={i}
                data-reveal
                className={`${f.span === 'col-span-2' ? 'md:col-span-2' : 'md:col-span-1'} group relative rounded-2xl border border-gray-100 bg-white p-8 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-100 hover:-translate-y-1`}
                style={{
                  boxShadow: '0 2px 8px rgba(5, 96, 69, 0.04), 0 0 0 1px rgba(5, 96, 69, 0.02)',
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors duration-300">
                  <f.icon size={22} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 font-light leading-relaxed text-[0.95rem]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="py-20 px-6 bg-emerald-50/50 border-y border-emerald-100/50">
        <div className="max-w-5xl mx-auto" ref={statsRef}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center">
            <div data-reveal>
              <span ref={counter1} className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 tabular-nums">0</span>
              <span className="text-4xl sm:text-5xl font-bold text-emerald-600">+</span>
              <p className="text-gray-500 mt-2 font-medium text-sm">horses managed</p>
            </div>
            <div data-reveal>
              <span ref={counter2} className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 tabular-nums">0</span>
              <p className="text-gray-500 mt-2 font-medium text-sm">active trainers</p>
            </div>
            <div data-reveal>
              <span ref={counter3} className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 tabular-nums">0</span>
              <span className="text-4xl sm:text-5xl font-bold text-emerald-600">.7%</span>
              <p className="text-gray-500 mt-2 font-medium text-sm">system uptime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Flag size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-gray-900">HorseRacing</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy policy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms of service</a>
          </div>

          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} HorseRacing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
