import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Flag,
  HeartPulse,
  Trophy,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { useStore } from '../store/store';
import { useGsapReveal, useGsapCounter } from '../hooks/useGsapReveal';

gsap.registerPlugin(ScrollTrigger);

const flows = [
  {
    icon: Users,
    title: 'Hồ sơ và lý lịch ngựa',
    desc: 'Định danh, số chip, phả hệ ba đời, quyền sở hữu theo tỉ lệ, chỉ số cơ thể và sơ đồ ô chuồng của toàn đàn.',
    span: 'md:col-span-2',
  },
  {
    icon: ClipboardList,
    title: 'Giáo án huấn luyện',
    desc: 'Giáo án chia giai đoạn, tuần mẫu theo cự ly, khối lượng và mặt sân.',
    span: 'md:col-span-1',
  },
  {
    icon: Activity,
    title: 'Theo dõi buổi tập',
    desc: 'Nhịp tim và tốc độ từng giây, cảnh báo vượt ngưỡng ngay khi ngựa còn trên sân.',
    span: 'md:col-span-1',
  },
  {
    icon: HeartPulse,
    title: 'Y tế và chấn thương',
    desc: 'Hồ sơ khám, phác đồ, bản đồ chấn thương và khóa huấn luyện khẩn cấp chặn mọi bài tập nặng.',
    span: 'md:col-span-2',
  },
  {
    icon: UtensilsCrossed,
    title: 'Chăm sóc hằng ngày',
    desc: 'Khẩu phần đã duyệt, checklist tại chuồng, báo sự cố kèm ảnh và theo dõi vật tư theo khu.',
    span: 'md:col-span-1',
  },
  {
    icon: Trophy,
    title: 'Thi đấu và chi phí',
    desc: 'Đăng ký giải theo điều kiện được đua, chủ ngựa duyệt, báo cáo chi phí và tiền thưởng theo tỉ lệ sở hữu.',
    span: 'md:col-span-2',
  },
];

const roles = [
  {
    name: 'Huấn luyện viên trưởng',
    scope: 'Khu chuồng phụ trách',
    desc: 'Lập giáo án chia giai đoạn, phân công lịch tập cho đội chăm sóc, chấm điểm phong độ và viết nhận xét sau mỗi buổi tập.',
  },
  {
    name: 'Bác sĩ thú y',
    scope: 'Toàn câu lạc bộ',
    desc: 'Ghi hồ sơ khám, đánh dấu vị trí chấn thương, đổi trạng thái sức khỏe và đặt khóa huấn luyện khẩn cấp.',
  },
  {
    name: 'Nhân viên chăm sóc',
    scope: 'Ngựa được giao',
    desc: 'Cho ăn theo khẩu phần đã duyệt, vệ sinh chuồng, dắt ngựa ra sân và báo sự cố kèm ảnh ngay tại chuồng.',
  },
  {
    name: 'Chủ sở hữu ngựa',
    scope: 'Ngựa đang sở hữu',
    desc: 'Xem phả hệ và thành tích, đọc nhận xét của huấn luyện viên, duyệt đăng ký thi đấu, nhận báo cáo chi phí và tiền thưởng.',
  },
  {
    name: 'Quản lý câu lạc bộ',
    scope: 'Toàn câu lạc bộ',
    desc: 'Quản lý hồ sơ ngựa, khu chuồng, nhân sự và phân quyền; xem báo cáo vận hành và nhật ký thao tác.',
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

  const counter1 = useGsapCounter(38);
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md">
              <Flag size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">HorseRacing</span>
          </div>
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
            className="mb-4 text-sm font-semibold tracking-wide text-emerald-300 sm:text-base"
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
            Một câu lạc bộ đua ngựa đang quản lý hồ sơ, giáo án, sổ y tế và việc chăm sóc hằng ngày ở
            những nơi rời rạc. Hệ thống này gom tất cả quanh một con ngựa, để quyết định của bác sĩ chặn
            được lịch tập ngay lập tức và mỗi vai trò chỉ thấy đúng phần việc của mình.
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

      {/* ===== NĂM LUỒNG NGHIỆP VỤ ===== */}
      <section id="chuc-nang" className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-xl" ref={introRef}>
            <p className="mb-3 text-sm font-semibold tracking-wide text-emerald-600" data-reveal>
              Dựng cho câu lạc bộ đua ngựa
            </p>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" data-reveal>
              Năm luồng nghiệp vụ nối liền quanh một con ngựa
            </h2>
            <p className="text-lg font-light leading-relaxed text-gray-500" data-reveal>
              Từ lúc lập hồ sơ tới ngày ra đường đua. Bác sĩ khóa huấn luyện thì lịch tập tự hủy; ngựa đổi
              khu thì giáo án được gắn cờ cho huấn luyện viên mới.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3" ref={featuresRef}>
            {flows.map((flow) => (
              <div
                key={flow.title}
                data-reveal
                className={`${flow.span} group relative rounded-2xl border border-gray-100 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-500/5`}
                style={{ boxShadow: '0 2px 8px rgba(5, 96, 69, 0.04), 0 0 0 1px rgba(5, 96, 69, 0.02)' }}
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 transition-colors duration-300 group-hover:bg-emerald-100">
                  <flow.icon size={22} className="text-emerald-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{flow.title}</h3>
                <p className="text-[0.95rem] font-light leading-relaxed text-gray-500">{flow.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NĂM VAI TRÒ ===== */}
      <section className="border-y border-emerald-100/50 bg-emerald-50/40 px-6 py-24">
        <div className="mx-auto max-w-6xl" ref={rolesRef}>
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-semibold tracking-wide text-emerald-600" data-reveal>
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
        <div className="mx-auto max-w-5xl" ref={statsRef}>
          <div className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3 sm:gap-6">
            <div data-reveal>
              <span ref={counter1} className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums sm:text-5xl">
                0
              </span>
              <p className="mt-2 text-sm font-medium text-gray-500">chức năng nghiệp vụ</p>
            </div>
            <div data-reveal>
              <span ref={counter2} className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums sm:text-5xl">
                0
              </span>
              <p className="mt-2 text-sm font-medium text-gray-500">khung giờ tập mỗi ngày</p>
            </div>
            <div data-reveal>
              <span ref={counter3} className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums sm:text-5xl">
                0
              </span>
              <p className="mt-2 text-sm font-medium text-gray-500">vai trò có phân quyền riêng</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHÂN TRANG ===== */}
      <footer className="border-t border-gray-100 bg-white px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
              <Flag size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-gray-900">HorseRacing</span>
          </div>
          <p className="text-sm text-gray-400">
            Hệ thống Quản lý Huấn luyện Ngựa đua · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
