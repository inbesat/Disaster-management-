"use client";
import { useEffect, useState } from "react";
type Integration = { id: string; configured: boolean };
export default function IntegrationsSettingsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => {
    void fetch("/api/integrations")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setItems(data.integrations);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function preview(source: string) {
    setResult("Loading…");
    try {
      const r = await fetch(`/api/integrations?source=${source}`);
      const data = await r.json();
      setResult(r.ok ? JSON.stringify(data, null, 2) : data.error);
    } catch {
      setResult("Could not reach this source.");
    }
  }
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <p className="text-sm text-muted">
        Connections use server configuration. Configured means credentials are present; it
        does not guarantee provider access or quota.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="min-w-0 rounded-xl border border-border bg-secondary p-4"
          >
            <h2 className="font-semibold capitalize">{item.id}</h2>
            <p className="mt-2 text-sm">
              {item.configured ? "Configured on server" : "Not configured"}
            </p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          ["events", "Natural events"],
          ["space-weather", "Space weather"],
          ["notion", "Notion documents"],
          ["country&q=India", "Country information"],
        ].map(([source, label]) => (
          <button
            key={source}
            className="min-h-11 rounded-lg border border-border px-4 py-2"
            onClick={() => void preview(source)}
          >
            {label}
          </button>
        ))}
      </div>
      {result && (
        <pre
          aria-live="polite"
          className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-4 text-xs"
        >
          {result}
        </pre>
      )}
    </section>
  );
}
