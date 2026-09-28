"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, LogIn, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/Logo";
import LanguageTranslator from "@/components/ui/LanguageTranslator";
import { LifeBuoy } from "lucide-react";

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Communication", href: "#communication" },
  { label: "Command Center", href: "#command-center" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Impact", href: "#impact" },
  { label: "FAQ", href: "#faq" },
];

/** Path-based links rendered beside the CTA buttons (scroll-spy skips these). */
const PATH_LINKS = [{ label: "Help", href: "/help" }];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Track which section is in view for active-link highlighting */
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.replace("#", ""));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const closeMobile = useCallback(() => setMenuOpen(false), []);

  /* Lock body scroll when mobile menu is open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="fixed top-4 w-full z-50 flex flex-col items-center">
      {/* Tier 1 — the main dark rounded pill (logo · links · CTAs).
          Width: near-full viewport (98vw, capped 1400px on 2xl screens).
          Padding: generous left rail (pl-8), tight-but-safe right edge
          (pr-4) so the rounded corners never clip the blue CTA. */}
      <div
        className={`w-full max-w-[98vw] 2xl:max-w-[1400px] mx-auto backdrop-blur-[16px] border border-white/10 rounded-full pl-8 pr-4 py-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[rgba(11,31,58,0.85)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]"
            : "bg-[rgba(11,31,58,0.55)]"
        }`}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 group">
          <Logo className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
          <span className="whitespace-nowrap text-white font-bold text-lg tracking-tight">
            SafeSphere
          </span>
        </a>

        {/* Desktop Nav Links — xl+ only: below 1280px the full bar
            physically cannot fit, so the hamburger menu takes over and
            nothing overflows the pill. gap-3 at xl / gap-4 on very wide
            screens keeps everything comfortably inside the pill. */}
        <div className="hidden xl:flex gap-3 2xl:gap-4 items-center">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`whitespace-nowrap text-sm px-2.5 py-2 rounded-lg transition-all duration-200 ${
                activeSection === link.href.replace("#", "")
                  ? "text-white bg-white/10"
                  : "text-[var(--text-on-navy)] hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs — INSIDE the rounded pill container. Simple flex
            row: no absolute positioning, no negative margins, no fixed
            widths. Request Demo is the primary CTA (vibrant blue); Sign
            In / Download App stay outline-secondary. */}
        <div className="hidden xl:flex items-center gap-3 shrink-0 whitespace-nowrap">
          {/* Google Translate widget host — layout.tsx injects the real
              dropdown here and auto-translates the whole page on select.
              Dark-themed via the GOOGLE TRANSLATE block in globals.css. */}
          <LanguageTranslator />
          <a
            href="/access"
            className="flex items-center gap-2 border border-white/20 text-white rounded-full px-3.5 py-2 text-sm font-medium hover:bg-white/10 hover:border-white/30 transition-all duration-200"
          >
            <LogIn size={14} aria-hidden="true" />
            Sign In
          </a>
          {/* Help Center — path link (scroll-spy skips it, like Sign In) */}
          {PATH_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 border border-white/20 text-white rounded-full px-3.5 py-2 text-sm font-medium hover:bg-white/10 hover:border-white/30 transition-all duration-200"
            >
              <LifeBuoy size={14} aria-hidden="true" />
              {link.label}
            </Link>
          ))}
          {/* App download — outline (secondary) so it doesn't compete with
              the solid Request Demo CTA. Routes to the /download hub so
              users pick their platform. */}
          <Link
            href="/download"
            className="whitespace-nowrap flex items-center gap-2 border border-white/20 text-white rounded-full px-3.5 py-2 text-sm font-medium hover:bg-white/10 hover:border-white/30 transition-all duration-200"
          >
            <Download size={14} aria-hidden="true" />
            Download App
          </Link>
          <a
            href="#contact"
            className="whitespace-nowrap bg-gradient-to-r from-[var(--blue)] to-[var(--blue-light)] text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-200 flex items-center gap-2"
          >
            Request Demo
            <ArrowRight size={14} />
          </a>
        </div>

        {/* Mobile toggle — shown below xl (where the desktop bar hides) */}
        <button
          className="xl:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className="xl:hidden w-full max-w-[98%] mx-auto bg-[rgba(11,31,58,0.95)] backdrop-blur-[20px] border border-white/10 rounded-2xl mt-2 p-4 flex flex-col gap-1"
          >
            {NAV_LINKS.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className={`text-sm px-4 py-3 rounded-lg transition-all block ${
                  activeSection === link.href.replace("#", "")
                    ? "text-white bg-white/10"
                    : "text-[var(--text-on-navy)] hover:text-white hover:bg-white/5"
                }`}
                onClick={closeMobile}
              >
                {link.label}
              </motion.a>
            ))}
            <div className="flex flex-col gap-3 mt-4 px-2">
              <a
                href="/access"
                onClick={closeMobile}
                className="flex items-center justify-center gap-2 border border-white/20 text-white rounded-full w-full py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
              >
                <LogIn size={14} aria-hidden="true" />
                Sign In
              </a>
              <Link
                href="/help"
                onClick={closeMobile}
                className="flex items-center justify-center gap-2 border border-white/20 text-white rounded-full w-full py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
              >
                <LifeBuoy size={14} aria-hidden="true" />
                Help Center
              </Link>
              <Link
                href="/download"
                onClick={closeMobile}
                className="flex items-center justify-center gap-2 border border-white/20 text-white rounded-full w-full py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
              >
                <Download size={14} aria-hidden="true" />
                Download App
              </Link>
              <a
                href="#contact"
                onClick={closeMobile}
                className="bg-gradient-to-r from-[var(--blue)] to-[var(--blue-light)] text-white rounded-full w-full py-2.5 text-sm text-center font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Request Demo
                <ArrowRight size={14} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
