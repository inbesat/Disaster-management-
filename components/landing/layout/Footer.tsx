"use client";

import React from "react";
import { Phone, Mail } from "lucide-react";
import Logo from "@/components/ui/Logo";

// ---------------------------------------------------------------------
// components/landing/layout/Footer.tsx — Phase 2 · Prompt 2.5
//
// Comprehensive 4-column dark footer:
//   - Column 1: Logo + tagline + description
//   - Column 2: Platform links (Features, Demo, Roadmap, API)
//   - Column 3: Resources links (Documentation, Open Source, NDMA, Contact)
//   - Column 4: Contact Us with phone + email
//   - Social icons (GitHub, Twitter, LinkedIn)
//   - Bottom bar: copyright + hackathon attribution
// ---------------------------------------------------------------------

const PLATFORM_LINKS = [
  { label: "Features", href: "#feature-cards" },
  { label: "Demo", href: "#demo" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "API", href: "#api" },
];

const RESOURCE_LINKS = [
  { label: "Help Center", href: "/help" },
  { label: "Documentation", href: "#docs" },
  { label: "Open Source", href: "#opensource" },
  { label: "NDMA Guidelines", href: "#ndma" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0a0f1a] pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">
          {/* Column 1 — Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <Logo className="h-9 w-9" />
              <span className="text-white font-bold text-lg">
                SafeSphere
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              AI-powered disaster management and last-mile emergency
              communication — built for governments, rescue teams, and citizens.
            </p>
          </div>

          {/* Column 2 — Platform */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-5">
              Platform
            </h4>
            <div className="space-y-3 flex flex-col">
              {PLATFORM_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors w-fit"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Column 3 — Resources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-5">
              Resources
            </h4>
            <div className="space-y-3 flex flex-col">
              {RESOURCE_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-slate-400 hover:text-white transition-colors w-fit"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Column 4 — Contact Us */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-5">
              Contact Us
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Phone size={14} className="text-white/40 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-400 block">
                    +91-9625130964
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="text-white/40 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-400 block">
                    +91-7251014013
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-white/40 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-400 block">
                    safesphere095@gmail.com
                  </span>
                  <span className="text-xs text-slate-500">(General)</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-white/40 mt-0.5" />
                <div>
                  <span className="text-sm text-slate-400 block">
                    anonymous4w08@gmail.com
                  </span>
                  <span className="text-xs text-slate-500">(Bug Reports)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mt-14 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div>
            © 2026 SafeSphere. Built for Bharat Shakti Hackathon.
          </div>
          <div className="flex items-center gap-1">
            Made for public safety, accessibility & trust.
          </div>
        </div>
      </div>
    </footer>
  );
}
