"use client";

// ---------------------------------------------------------------------
// components/ui/LanguageTranslator.tsx — Cookie-based language toggle.
//
// Custom dropdown that sets the Google Translate `googtrans` cookie
// and reloads the page so the Google Translate script translates the
// entire DOM. Reads the cookie on mount to sync the dropdown state.
// ---------------------------------------------------------------------

import { useState, useEffect, useId } from "react";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", native: "EN" },
  { code: "hi", label: "Hindi", native: "HI" },
  { code: "ml", label: "Malayalam", native: "ML" },
  { code: "bn", label: "Bengali", native: "BN" },
];

/**
 * Read the Google Translate cookie to detect the active language.
 * Cookie format: googtrans=/en/hi  →  extracts "hi"
 */
function getActiveLanguage(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-z]{2})/);
  return match?.[1] ?? "en";
}

/**
 * Set the Google Translate cookie and reload so the script translates the DOM.
 */
function setTranslationLanguage(lang: string) {
  document.cookie = `googtrans=/en/${lang}; path=/; SameSite=Lax`;
  try {
    localStorage.setItem("preferred_lang", lang);
  } catch {
    /* The cookie still selects the language. */
  }
  window.location.reload();
}

export default function LanguageTranslator() {
  const [activeLang, setActiveLang] = useState("en");
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setActiveLang(getActiveLanguage());
  }, []);

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-1.5 rounded-full border border-white/20 text-white px-3 py-2 text-sm font-medium hover:bg-white/10 hover:border-white/30 transition-all duration-200"
        aria-label="Select language"
      >
        <Globe size={14} aria-hidden="true" />
        <span className="text-xs font-bold">
          {LANGUAGES.find((l) => l.code === activeLang)?.native ?? "EN"}
        </span>
      </button>
      {/* Dropdown */}
      <ul
        id={menuId}
        hidden={!open}
        className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-white/10 bg-[rgba(11,31,58,0.95)] backdrop-blur-[20px] shadow-xl z-50 p-1.5"
      >
        {LANGUAGES.map((lang) => (
          <li key={lang.code}>
            <button
              onClick={() => setTranslationLanguage(lang.code)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all ${
                activeLang === lang.code
                  ? "bg-white/15 text-white font-semibold"
                  : "text-[var(--brand-textOnNavy)] hover:bg-white/5 hover:text-white"
              }`}
            >
              {lang.label}
              {activeLang === lang.code && (
                <span className="ml-1.5 text-accent text-xs">✓</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
