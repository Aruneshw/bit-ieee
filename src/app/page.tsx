import Link from "next/link";
import { ArrowRight, ShieldCheck, Users, Activity, Trophy, Zap, Globe, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* IEEE Blue Header (Inspired by Google Developers layout) */}
      <header className="sticky top-0 z-50 bg-[#00629B] shadow-md px-6 md:px-12 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo area (Google Developers style) */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#00629B]" />
              </div>
              <div className="h-6 w-px bg-white/20 mx-2 hidden sm:block" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                BIT <span className="font-light opacity-90">IEEE HUB</span>
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-6 py-2 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-all text-sm"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section (IEEE Blue Background) */}
      <section className="relative bg-[#00629B] py-20 md:py-32 overflow-hidden">
        {/* Engineering Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 space-y-6">
            <div className="inline-block px-3 py-1 rounded bg-[#00bfff]/20 border border-[#00bfff]/30 text-[#00bfff] text-[10px] font-bold uppercase tracking-[0.2em]">
              Student Branch Portal
            </div>
            <h2 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight">
              Advancing Technology <br />
              <span className="text-[#00bfff]">for Humanity.</span>
            </h2>
            <p className="text-xl text-blue-100/80 max-w-xl leading-relaxed">
              The central hub for BIT Sathy students to engage with 12 specialized IEEE technical societies, 
              track activity points, and build professional engineering resumes.
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#00629B] rounded-lg font-bold shadow-xl hover:bg-blue-50 transition-all hover:-translate-y-1"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="flex-1 hidden lg:block">
            {/* Visual element (IEEE Blue 3D-ish card) */}
            <div className="relative w-full aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00bfff]/20 to-transparent rounded-full blur-3xl" />
              <div className="relative glass-card p-8 border-white/20 bg-white/5 backdrop-blur-xl rotate-3 translate-x-4">
                <div className="space-y-4">
                  <div className="h-4 w-1/3 bg-white/20 rounded" />
                  <div className="h-10 w-full bg-white/10 rounded" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-20 bg-white/5 rounded" />
                    <div className="h-20 bg-white/5 rounded" />
                  </div>
                </div>
              </div>
              <div className="absolute top-10 left-0 glass-card p-6 border-white/20 bg-white/10 backdrop-blur-xl -rotate-6 -translate-x-4">
                <Trophy className="w-12 h-12 text-[#00bfff] mb-4" />
                <div className="h-4 w-24 bg-white/20 rounded" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content (White Background like IEEE.org) */}
      <main className="flex-1 bg-white">
        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-6 -mt-12 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 bg-gray-200 border border-gray-200 rounded-xl overflow-hidden shadow-2xl">
            <StatItem value="12" label="Technical Societies" />
            <StatItem value="500+" label="Active Members" />
            <StatItem value="100+" label="Annual Events" />
            <StatItem value="24/7" label="Cloud Access" />
          </div>
        </div>

        {/* Features Section */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Core Ecosystem</h3>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Experience a streamlined engineering environment designed to boost your career trajectory.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Secure Access"
              description="Role-based management for Members, Leaders, and Branch Counselors."
            />
            <FeatureCard 
              icon={<Activity className="w-6 h-6" />}
              title="Point Tracking"
              description="Automated logging of IEEE activity points for every event attended."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Collaborate"
              description="Connect with peers across various disciplines and technical societies."
            />
            <FeatureCard 
              icon={<Trophy className="w-6 h-6" />}
              title="IEEE Resume"
              description="Instantly generate a verified PDF resume based on your SB contributions."
            />
          </div>
        </section>

        {/* Societies Grid (Inspired by IEEE.org landing grid) */}
        <section className="bg-gray-50 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
              <div className="max-w-xl">
                <h3 className="text-4xl font-bold text-gray-900 mb-4">Technical Societies</h3>
                <p className="text-gray-500">
                  Join the world's largest technical professional organization dedicated to advancing technology.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {societies.map((society, index) => (
                <div 
                  key={index}
                  className="bg-white p-6 border border-gray-100 hover:border-[#00629B] hover:shadow-lg transition-all group"
                >
                  <p className="font-bold text-[#00629B] mb-2">{society.abbr}</p>
                  <p className="text-sm text-gray-600 leading-tight">{society.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#001a2c] py-12 text-center text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-[#00bfff]" />
            <span className="font-bold text-white tracking-widest uppercase text-xs">BIT IEEE HUB</span>
          </div>
          <p>&copy; {new Date().getFullYear()} BITS Sathy IEEE Student Branch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white p-8 text-center">
      <p className="text-3xl font-bold text-[#00629B]">{value}</p>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-8 border border-gray-100 rounded-xl hover:shadow-xl transition-all hover:border-[#00bfff]/30 group">
      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-6 text-[#00629B] group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

const societies = [
  { abbr: "EMBS", name: "Engineering in Medicine & Biology" },
  { abbr: "PES", name: "Power and Energy" },
  { abbr: "OES", name: "Oceanic Engineering" },
  { abbr: "RAS", name: "Robotics & Automation" },
  { abbr: "CIS", name: "Computational Intelligence" },
  { abbr: "CS", name: "Computer Society" },
  { abbr: "PELS", name: "Power Electronics" },
  { abbr: "CASS", name: "Circuits & Systems" },
  { abbr: "EDS", name: "Electron Devices" },
  { abbr: "CSS", name: "Control Systems" },
  { abbr: "ITSS", name: "Intelligent Transportation" },
];
