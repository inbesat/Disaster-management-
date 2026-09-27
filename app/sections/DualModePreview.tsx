"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Smartphone, Monitor, Shield, Activity, Users, Bell } from "lucide-react";
import ScrollReveal from "@/components/landing/ui/ScrollReveal";

// ---------------------------------------------------------------------
// app/sections/DualModePreview.tsx — Phase 2 · Prompt 2.4
//
// "Two Modes, One Mission" section with side-by-side mockups:
//   - Left: Public mobile UI (clean, calming, giant safety status)
//   - Right: Gov dashboard (dark, data-dense, multi-panel)
//   - CSS device frames (mobile phone, browser window)
//   - Parallax scroll effect (different speeds)
//   - Gradient divider between devices
// ---------------------------------------------------------------------

function MobileFrame() {
  return (
    <div className="relative mx-auto w-[280px]">
      {/* Phone bezel */}
      <div className="relative rounded-[36px] border-[3px] border-slate-700 bg-slate-900 p-2 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-20" />

        {/* Screen */}
        <div className="rounded-[28px] overflow-hidden bg-gradient-to-b from-emerald-50 to-white min-h-[480px]">
          {/* Status bar */}
          <div className="flex justify-between items-center px-6 pt-8 pb-2 text-xs text-slate-600">
            <span>9:41</span>
            <div className="flex gap-1">
              <div className="w-4 h-2.5 border border-slate-600 rounded-sm" />
            </div>
          </div>

          {/* App content */}
          <div className="px-5 pt-4">
            {/* Safety status - giant */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Shield size={48} className="text-emerald-500" />
              </div>
              <span className="text-3xl font-bold text-emerald-600">SAFE</span>
              <p className="text-sm text-slate-500 mt-1">Your area is secure</p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm">
                <Bell size={20} className="text-blue-500 mb-1" />
                <span className="text-[10px] text-slate-600">Alerts</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm">
                <Activity size={20} className="text-orange-500 mb-1" />
                <span className="text-[10px] text-slate-600">Report</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-white shadow-sm">
                <Users size={20} className="text-purple-500 mb-1" />
                <span className="text-[10px] text-slate-600">Nearby</span>
              </div>
            </div>

            {/* Alert banner */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-semibold text-amber-700">WATCH</span>
              </div>
              <p className="text-xs text-amber-600">
                Heavy rainfall expected in your district
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-emerald-400">
          <Smartphone size={14} />
          For Citizens
        </span>
      </div>
    </div>
  );
}

function BrowserFrame() {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* Browser chrome */}
      <div className="rounded-t-xl bg-slate-800 border border-slate-700 border-b-0">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-400">
              safesphere0.netlify.app
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-4 min-h-[380px] border border-slate-700 border-t-0 rounded-b-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-white">National Dashboard</h4>
              <p className="text-[10px] text-slate-400">Real-time monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">LIVE</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Active", value: "12", color: "text-red-400" },
              { label: "Teams", value: "847", color: "text-blue-400" },
              { label: "Shelters", value: "2.1K", color: "text-emerald-400" },
              { label: "Alerts", value: "34", color: "text-amber-400" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-center"
              >
                <div className={`text-lg font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Map placeholder */}
          <div className="h-32 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
            <div className="text-center">
              <Activity size={24} className="text-slate-600 mx-auto mb-1" />
              <span className="text-[10px] text-slate-500">Live Map View</span>
            </div>
          </div>

          {/* Table */}
          <div className="space-y-2">
            {["Flood - Assam", "Cyclone - Odisha", "Earthquake - Nepal"].map(
              (event, i) => (
                <div
                  key={event}
                  className="flex items-center justify-between p-2 rounded bg-slate-800 border border-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        i === 0
                          ? "bg-red-400"
                          : i === 1
                            ? "bg-amber-400"
                            : "bg-orange-400"
                      }`}
                    />
                    <span className="text-xs text-white">{event}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">CRITICAL</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-sm font-medium text-blue-400">
          <Monitor size={14} />
          For Officials
        </span>
      </div>
    </div>
  );
}

export default function DualModePreview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Parallax: mobile moves up slower, gov dashboard moves up faster
  const mobileY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const govY = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <section
      ref={sectionRef}
      className="py-28 relative overflow-hidden"
      id="dual-mode"
    >
      {/* Gradient divider background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div className="absolute left-1/4 top-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] -translate-y-1/2" />
        <div className="absolute right-1/4 top-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <ScrollReveal>
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-purple-400 mb-4">
              Two Modes, One Mission
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Built for every stakeholder
            </h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto">
              A citizen-facing app that&apos;s simple and calming, paired with a
              command center that&apos;s powerful and data-dense.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          {/* Mobile (Citizens) — parallax */}
          <motion.div style={{ y: mobileY }} className="flex justify-center">
            <MobileFrame />
          </motion.div>

          {/* Gov Dashboard — parallax (faster) */}
          <motion.div style={{ y: govY }} className="flex justify-center">
            <BrowserFrame />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
