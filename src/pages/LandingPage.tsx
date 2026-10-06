import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Activity,
  ArrowRight,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  HeartPulse,
  Lock,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useStore } from '../store/store';
import { Logo } from '../components/Logo';
import { useGsapReveal, useGsapCounter } from '../hooks/useGsapReveal';

gsap.registerPlugin(ScrollTrigger);

/** Ba luồng nghiệp vụ bắt buộc — bố cục bento: một ô lớn và hai ô xếp chồng. */
const flows: { icon: typeof Users; title: string; desc: string; points?: string[]; big: boolean }[] = [
  {
    icon: ClipboardList,
    title: 'Lập và thực hiện giáo án theo lớp',
    desc: 'Huấn luyện viên soạn môn học, ghép thành giáo án theo giai đoạn rồi mở lớp với khung giờ và sĩ số. Ngựa đăng ký vào lớp, lịch tập của từng con được tính ra từ các lớp đang học. Buổi tập theo dõi nhịp tim và tốc độ từng giây, cảnh báo đỏ tới ngay người đang dắt ngựa.',
    points: ['Môn học → giáo án → lớp → buổi học', 'Một buổi nhiều ngựa, chấm điểm từng con', 'Ngựa không đủ điều kiện chỉ vắng riêng, lớp vẫn chạy'],
    big: true,
  },
  {
    icon: Users,
    title: 'Hồ sơ và lý lịch ngựa',
    desc: 'Định danh, số chip, phả hệ ba đời, một chủ sở hữu, chỉ số cơ thể có cảnh báo và quy trình xếp khu → ô → Groom.',
    big: false,
  },
  {
    icon: HeartPulse,
    title: 'Y tế và xử lý chấn thương',
    desc: 'Yêu cầu khám, bệnh án gồm nhiều buổi khám, khám định kỳ theo chu kỳ chung và khóa huấn luyện độc lập với trạng thái sức khỏe.',
    big: false,
  },
];

const roles = [
  {
    name: 'Huấn luyện viên trưởng',
    scope: 'Các khu chuồng phụ trách',
    desc: 'Soạn môn học và giáo án, mở lớp, đăng ký ngựa, điều hành buổi tập, chấm điểm từng ngựa, xếp ô và phân công Groom.',
  },
  {
    name: 'Bác sĩ thú y',
    scope: 'Toàn câu lạc bộ',
    desc: 'Tiếp nhận yêu cầu khám, ghi buổi khám, mở và đóng bệnh án, đổi trạng thái sức khỏe, đặt khóa huấn luyện, đặt ngưỡng nhịp tim.',
  },
  {
    name: 'Nhân viên chăm sóc',
    scope: 'Ngựa được phân công',
    desc: 'Chuẩn bị ngựa, đưa ra sân, chăm sóc sau tập, ghi chỉ số cơ thể và gửi yêu cầu khám khi ngựa có dấu hiệu bất thường.',
  },
  {
    name: 'Chủ sở hữu ngựa',
    scope: 'Ngựa đang sở hữu',
    desc: 'Xem hồ sơ, phả hệ, lịch tập, nhận xét sau buổi tập và bệnh án kèm chi phí khi bệnh án đã đóng.',
  },
  {
    name: 'Quản lý câu lạc bộ',
    scope: 'Toàn câu lạc bộ',
    desc: 'Tạo hồ sơ ngựa, xếp khu chuồng, quản lý danh mục khu và ô, vòng đời hồ sơ, nhân sự, phân quyền và nhật ký thao tác.',
  },
];

const LandingPage = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const introRef = useGsapReveal({ stagger: 0.12, distance: 50 });
  const featuresRef = useGsapReveal({ stagger: 0.12, distance: 50 });
  const rolesRef = useGsapReveal({ direction: 'up', stagger: 0.08 });
  const statsRef = useGsapReveal({ direction: 'up', stagger: 0.12 });

  const counter1 = useGsapCounter(29);
  const counter2 = useGsapCounter(6);
  const counter3 = useGsapCounter(5);

  useEffect(() => {
    if (!titleRef.current || !heroRef.current) return;

    const timeline = gsap.timeline({ delay: 0.3 });

    const title = titleRef.current;
    const text = title.textContent || '';
    title.textContent = '';
    const chars = text.split('').map((char) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? ' ' : char;
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      title.appendChild(span);
      return span;
    });

    timeline.to(chars, { opacity: 1, y: 0, duration: 0.05, stagger: 0.04, ease: 'power2.out' });
    timeline.fromTo(
      heroRef.current.querySelectorAll('[data-hero-reveal]'),
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' },
      '-=0.3',
    );
    timeline.fromTo(
      heroRef.current.querySelector('[data-scroll-indicator]'),
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
      '-=0.2',
    );

    return () => {
      timeline.kill();
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans">
      {/* ===== HERO ===== */}
      <section ref={heroRef} className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
          <source src="/16042528_3840_2160_24fps.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-white" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-transparent" />
        <div className="noise-overlay pointer-events-none absolute inset-0" />

        {/* Thanh điều hướng: logo bên trái, nút đăng nhập bên phải */}
        <nav
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-5 sm:px-8"
          data-hero-reveal
        >
          <Logo size={34} textClassName="text-white" />
          <div className="flex items-center gap-3">
            <a
              href="#chuc-nang"
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              Chức năng
            </a>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-2 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/25"
            >
              {isAuthenticated ? 'Vào hệ thống' : 'Đăng nhập'}
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto mt-[-5vh] max-w-4xl px-6 text-center">
          <p
            className="mb-4 text-sm font-semibold text-emerald-300 sm:text-base"
            data-hero-reveal
          >
            Hệ thống Quản lý Huấn luyện Ngựa đua
          </p>
          <h1
            ref={titleRef}
            className="mb-6 text-5xl font-extrabold leading-[0.95] tracking-tighter text-white sm:text-6xl md:text-7xl lg:text-8xl"
          >
            HorseRacing
          </h1>

          <p
            className="mx-auto mb-10 max-w-2xl text-lg font-light leading-relaxed text-white/80 sm:text-xl"
            data-hero-reveal
          >
            Hồ sơ ngựa, lớp huấn luyện và sổ y tế trong một nơi. Quyết định của bác sĩ có hiệu lực ngay
            với buổi tập kế tiếp, và mỗi vai trò chỉ thấy đúng phần việc của mình.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row" data-hero-reveal>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="group flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 transition-all duration-300 hover:bg-emerald-500"
            >
              {isAuthenticated ? 'Vào hệ thống' : 'Bắt đầu'}
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a
              href="#chuc-nang"
              className="rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
            >
              Xem chức năng
            </a>
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          data-scroll-indicator
        >
          <span className="text-xs font-light tracking-widest text-white/50">cuộn xuống</span>
          <ChevronDown size={20} className="animate-bounce text-white/50" />
        </div>
      </section>

      {/* ===== BA LUỒNG NGHIỆP VỤ ===== */}
      <section id="chuc-nang" className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 grid gap-6 lg:grid-cols-12 lg:items-end" ref={introRef}>
            <div className="lg:col-span-7">
              <p className="mb-3 text-sm font-semibold text-emerald-700" data-reveal>
                Dựng cho câu lạc bộ đua ngựa
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" data-reveal>
                Ba luồng nghiệp vụ nối liền quanh một con ngựa
              </h2>
            </div>
            <p className="text-lg font-light leading-relaxed text-gray-500 lg:col-span-5" data-reveal>
              Bác sĩ đặt khóa huấn luyện thì ngựa tự vắng ở buổi kế tiếp mà lớp vẫn chạy. Ngựa đổi khu thì tự rút khỏi
              lớp của khu cũ. Không có thao tác nào phải làm tay hai lần.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:grid-rows-2" ref={featuresRef}>
            {flows.map((flow) => (
              <div
                key={flow.title}
                data-reveal
                className={
                  flow.big
                    ? 'group relative overflow-hidden rounded-3xl bg-emerald-950 p-8 text-white shadow-[0_30px_60px_-30px_rgba(6,78,59,0.8)] sm:p-10 lg:col-span-7 lg:row-span-2'
                    : 'group relative rounded-3xl bg-emerald-50/60 p-8 ring-1 ring-emerald-900/5 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-50 lg:col-span-5'
                }
              >
                {flow.big && (
                  <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
                )}
                <div
                  className={
                    flow.big
                      ? 'mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10'
                      : 'mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm'
                  }
                >
                  <flow.icon size={22} className={flow.big ? 'text-emerald-300' : 'text-emerald-700'} />
                </div>
                <h3 className={flow.big ? 'mb-3 text-2xl font-semibold' : 'mb-2 text-lg font-semibold text-gray-900'}>
                  {flow.title}
                </h3>
                <p
                  className={
                    flow.big
                      ? 'max-w-xl text-[1.02rem] font-light leading-relaxed text-emerald-50/80'
                      : 'text-[0.95rem] font-light leading-relaxed text-gray-500'
                  }
                >
                  {flow.desc}
                </p>
                {flow.points && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {flow.points.map((point) => (
                      <span key={point} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-emerald-50/90">
                        {point}
                      </span>
                    ))}
                  </div>
                )}
                {flow.big && (
                  <div className="mt-10 grid max-w-lg grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm text-emerald-50/80">
                    <CalendarRange size={18} className="text-emerald-300" />
                    <span>Sáu khung giờ cố định mỗi ngày, mỗi lớp dùng một khung giờ</span>
                    <Activity size={18} className="text-emerald-300" />
                    <span>Cảnh báo tim vượt ngưỡng, nghi chấn thương, mất tín hiệu</span>
                    <Lock size={18} className="text-emerald-300" />
                    <span>Khóa huấn luyện chặn đăng ký lớp và buổi tập ngay lập tức</span>
                    <Stethoscope size={18} className="text-emerald-300" />
                    <span>Nghi chấn thương trong buổi tập tự thành yêu cầu khám</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NĂM VAI TRÒ ===== */}
      <section className="border-y border-emerald-100/50 bg-emerald-50/40 px-6 py-24">
        <div className="mx-auto max-w-7xl" ref={rolesRef}>
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-semibold text-emerald-700" data-reveal>
              Một hệ thống, năm góc nhìn
            </p>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900" data-reveal>
              Mỗi vai trò thấy đúng phần việc của mình
            </h2>
            <p className="text-lg font-light leading-relaxed text-gray-500" data-reveal>
              Phạm vi dữ liệu được lọc ngay ở tầng dịch vụ chứ không phải ẩn bớt trên giao diện: thông tin
              ngoài quyền không có trong dữ liệu trả về.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role, index) => (
              <div
                key={role.name}
                data-reveal
                className={`border-l-2 border-emerald-200 pl-5 ${index === 0 ? 'lg:row-span-2' : ''}`}
              >
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                <p className="mt-0.5 text-xs font-medium text-emerald-600">Phạm vi: {role.scope}</p>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-gray-500">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SỐ LIỆU ===== */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-12" ref={statsRef}>
          <div className="lg:col-span-5" data-reveal>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Gọn trong phạm vi đồ án, đủ cho một câu lạc bộ</h2>
            <p className="mt-2 font-light text-gray-500">Ba luồng bắt buộc: hồ sơ ngựa, huấn luyện theo lớp, y tế và chấn thương.</p>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-8 lg:col-span-7 lg:justify-end">
            <div data-reveal>
              <span ref={counter1} className="text-5xl font-bold tracking-tight text-emerald-800 tabular-nums">
                0
              </span>
              <p className="mt-1 text-sm font-medium text-gray-500">chức năng nghiệp vụ</p>
            </div>
            <div data-reveal>
              <span ref={counter2} className="text-5xl font-bold tracking-tight text-gray-900 tabular-nums">
                0
              </span>
              <p className="mt-1 text-sm font-medium text-gray-500">khung giờ tập mỗi ngày</p>
            </div>
            <div data-reveal>
              <span ref={counter3} className="text-5xl font-bold tracking-tight text-gray-900 tabular-nums">
                0
              </span>
              <p className="mt-1 text-sm font-medium text-gray-500">vai trò có phân quyền riêng</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHÂN TRANG ===== */}
      <footer className="border-t border-gray-100 bg-white px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo size={28} textClassName="text-sm" />
          <p className="text-sm text-gray-400">
            Hệ thống Quản lý Huấn luyện Ngựa đua · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
