"use client";

import { useState } from "react";
import Link from "next/link";
import { LocateFixed, MapPin, MessageSquareText, Upload } from "lucide-react";
import PublicBackButton from "@/components/public/PublicBackButton";
import { submitCitizenReport, type CitizenReportInput } from "@/app/actions/reports";

const REPORT_TYPES = [
  { value: "flooding", label: "Flooding / Waterlogging" },
  { value: "road_blocked", label: "Blocked Road" },
  { value: "shelter_needed", label: "Need Shelter" },
  { value: "rescue", label: "Rescue Needed" },
] as const;

type Gps = { lat: number; lng: number };

export function CitizenReportForm({ initialType }: { initialType?: string }) {
  const [reportType, setReportType] = useState<CitizenReportInput["reportType"]>(
    REPORT_TYPES.some((t) => t.value === initialType)
      ? (initialType as CitizenReportInput["reportType"])
      : "flooding",
  );
  const [rawText, setRawText] = useState("");
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [receiptMessage, setReceiptMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receiptId, setReceiptId] = useState("");

  function useMyLocation() {
    setGpsError(null);
    if (!("geolocation" in navigator)) {
      setGpsError("Your browser does not support GPS.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
        });
        setLoading(false);
      },
      () => {
        setGpsError("Unable to get location — please try again or allow access.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setGpsError("Photo must be a JPG, PNG or WebP image under 5 MB.");
      e.target.value = "";
      return;
    }
    setGpsError(null);
    setImageName(file.name);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!gps) {
      setGpsError("Tap 'Use My GPS Location' first.");
      return;
    }
    setLoading(true);
    try {
      const photoData = new FormData();
      if (imageFile) photoData.set("photo", imageFile);
      const result = await submitCitizenReport(
        {
          lat: gps.lat,
          lng: gps.lng,
          reportType,
          rawText,
          source: "app",
        },
        photoData,
      );
      if (result.ok) {
        setReceiptId(result.id);
        setReceiptMessage(result.message ?? "");
        setSubmitted(true);
      } else setGpsError(result.message ?? "Something went wrong.");
    } catch (err: unknown) {
      setGpsError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="eoc-panel flex max-w-md flex-col items-center gap-5 p-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-severity-green-500/20">
          <svg
            className="h-14 w-14 text-severity-green-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Report Submitted</h1>
        <p className="break-all text-xs text-slate-400">Reference ID: {receiptId}</p>
        <p className="text-slate-300">Stay Safe.</p>
        {receiptMessage && (
          <p role="status" className="text-sm text-amber-300">
            {receiptMessage}
          </p>
        )}
        <Link
          href="/public/reports"
          className="w-full rounded-eoc border border-accent px-4 py-3 font-semibold text-accent"
        >
          Track My Reports
        </Link>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setRawText("");
            setGps(null);
            setImageName(null);
            setImageDataUrl(null);
            setImageFile(null);
            setGpsError(null);
          }}
          className="mt-2 w-full rounded-eoc bg-accent py-3 text-sm font-semibold text-slate-950 transition hover:bg-accent/80"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-eoc border border-border bg-surface-elevated px-4 py-3.5 text-base text-foreground placeholder-slate-500 outline-none transition focus:border-accent";

  return (
    <main className="min-h-screen bg-background relative">
      <PublicBackButton className="sm:left-4 sm:top-3 top-3 left-3 bg-black/20" />
      <header className="border-b border-border pl-16">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 animate-pulse-ring rounded-full bg-severity-red-500" />
            <span className="font-bold tracking-tight text-foreground">
              Citizen Report
            </span>
          </div>
          <span className="eoc-label text-severity-amber-500">GROUND TRUTH</span>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Report an Emergency</h1>
        <p className="mt-1 text-slate-400">
          Share what you are seeing so responders know before they arrive.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {/* GPS */}
          <div className="eoc-panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Your Location</p>
              {gps && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-severity-green-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-eoc border-2 border-accent bg-accent/10 py-4 text-base font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"
            >
              <LocateFixed className={loading ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
              {gps ? "Update My GPS Location" : "Use My GPS Location"}
            </button>
            {gpsError && <p className="mt-2 text-sm text-severity-red-400">{gpsError}</p>}
          </div>

          {/* Report type */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Type of Report
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setReportType(t.value)}
                  className={`rounded-eoc border px-3 py-3.5 text-sm font-semibold transition ${
                    reportType === t.value
                      ? "border-accent bg-accent text-slate-950"
                      : "border-border bg-surface-elevated text-foreground hover:border-accent/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="desc"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              <MessageSquareText className="h-4 w-4" /> Describe the Situation
            </label>
            <textarea
              id="desc"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. Water rising fast on Station Road, we need evacuation."
              rows={4}
              maxLength={2000}
              className={`${inputClass} resize-none`}
              required
            />
          </div>

          {/* Image upload */}
          <div>
            <label
              htmlFor="photo"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              <Upload className="h-4 w-4" /> Upload a Photo (optional)
            </label>
            <label className="eoc-panel flex cursor-pointer items-center justify-center gap-2 border-dashed p-5 text-sm text-slate-300 transition hover:border-accent hover:text-accent">
              <Upload className="h-5 w-5" />
              {imageName ? imageName : "Tap to attach an image"}
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImage}
              />
            </label>
            {imageDataUrl && (
              <img
                src={imageDataUrl}
                alt="Report preview"
                className="mt-3 h-40 w-full rounded-eoc border border-border object-cover"
              />
            )}
            {imageDataUrl && (
              <button
                type="button"
                onClick={() => {
                  setImageDataUrl(null);
                  setImageName(null);
                  setImageFile(null);
                }}
                className="mt-2 text-sm text-accent underline"
              >
                Remove photo
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-eoc bg-severity-red-500 py-5 text-lg font-bold text-white transition hover:bg-severity-red-600 disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Submit Report"}
          </button>
          <Link
            href="/public/reports"
            className="block text-center text-sm text-accent underline"
          >
            Track reports from this browser
          </Link>
          <p className="text-center text-xs text-slate-500">
            Emergency? Call the District Control Room{" "}
            <a href="tel:1070" className="font-semibold text-severity-red-400">
              1070
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}
