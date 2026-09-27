from pathlib import Path
p=Path('components/public/transparency/PublicTransparencyFrame.tsx');s=p.read_text(encoding='utf-8')
a=s.index('      {/* ── Drawer panel');b=s.index('          {/* ── Pinned header',a)
s=s[:a]+'''      {/* Render the panel only while open so it cannot widen the document. */}
      {isOpen && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed top-0 right-0 z-[70] h-[100dvh] w-full border-l border-white/10 bg-[rgb(var(--bg-primary-rgb)/95)] backdrop-blur-xl md:w-[400px]"
        >
          <div className="relative flex h-full flex-col overflow-hidden">
'''+s[b:]
s=s.replace('      </aside>\n\n      {/* ── Mobile floating trigger', '        </aside>\n      )}\n\n      {/* ── Desktop drawer trigger ── */}\n      {!isOpen && (\n        <button\n          type="button"\n          onClick={() => setIsOpen(true)}\n          aria-haspopup="dialog"\n          aria-label="Open live response panel"\n          className="fixed right-0 top-1/3 z-[70] hidden h-16 w-12 -translate-y-1/2 items-center justify-center rounded-l-2xl border-y border-l border-white/20 bg-[var(--brand-navy2)] text-white shadow-xl hover:bg-slate-700 md:flex"\n        >\n          <BarChart2 aria-hidden className="h-5 w-5" />\n        </button>\n      )}\n\n      {/* ── Mobile floating trigger')
p.write_text(s,encoding='utf-8')
