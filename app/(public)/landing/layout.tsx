import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SafeSphere — AI-Powered Disaster Management Platform",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={"font-sans bg-[var(--brand-navy)] min-h-screen scroll-smooth"}
    >
      <main>{children}</main>
    </div>
  );
}
