"use client";

import { ExternalLink, Globe2 } from "lucide-react";

const societies = [
  { abbr: "CASS", name: "Circuits and Systems Society", link: "https://ieee-cas.org/" },
  { abbr: "CIS", name: "Computational Intelligence Society", link: "https://cis.ieee.org/" },
  { abbr: "CS", name: "Computer Society", link: "https://www.computer.org/" },
  { abbr: "CSS", name: "Control Systems Society", link: "https://ieeecss.org/" },
  { abbr: "EDS", name: "Electron Devices Society", link: "https://eds.ieee.org/" },
  { abbr: "EMBS", name: "Engineering in Medicine and Biology Society", link: "https://www.embs.org/" },
  { abbr: "IMS", name: "Instrumentation and Measurement Society", link: "https://ieee-ims.org/" },
  { abbr: "ITSS", name: "Intelligent Transportation Systems Society", link: "https://ieee-itss.org/" },
  { abbr: "OES", name: "Oceanic Engineering Society", link: "https://ieeeoes.org/" },
  { abbr: "PES", name: "Power and Energy Society", link: "https://ieee-pes.org/" },
  { abbr: "PELS", name: "Power Electronics Society", link: "https://www.ieee-pels.org/" },
  { abbr: "RAS", name: "Robotics and Automation Society", link: "https://www.ieee-ras.org/" },
];

export function AboutIEEE() {
  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* Header Section */}
      <section className="relative p-8 rounded-3xl overflow-hidden border border-white/5 bg-white/[0.02]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00629B]/10 blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10">
          <h1 className="text-4xl font-heading tracking-wide mb-6">About IEEE</h1>
          <p className="text-lg leading-relaxed text-gray-400 max-w-4xl">
            IEEE is the world's largest technical professional organization dedicated to advancing technology for the benefit of humanity. 
            IEEE and its members inspire a global community to innovate for a better tomorrow through its highly cited publications, 
            conferences, technology standards, and professional and educational activities. IEEE is the trusted “voice” for engineering, 
            computing, and technology information around the globe.
          </p>
        </div>
      </section>

      {/* Societies Grid */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-[#00629B]/10 flex items-center justify-center text-[#00bfff]">
            <Globe2 className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">IEEE Technical Societies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {societies.map((soc) => (
            <a
              key={soc.abbr}
              href={soc.link}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card p-5 group hover:border-[#00629B]/30 hover:bg-[#00629B]/5 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold tracking-widest text-[#00bfff] uppercase">
                    {soc.abbr}
                  </span>
                  <h3 className="font-semibold text-white group-hover:text-[#00bfff] transition-colors leading-tight">
                    {soc.name}
                  </h3>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-[#00bfff] transition-all opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer Note */}
      <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center">
        <p className="text-sm text-gray-500 italic">
          Explore more about our global community and technical societies by clicking the links above.
        </p>
      </div>
    </div>
  );
}
