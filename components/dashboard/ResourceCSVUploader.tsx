"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import toast from "react-hot-toast";
import { useInventoryActions } from "./InventoryProvider";
import { resourceInputError } from "@/lib/inventory/model";
import type { CsvResourceRow } from "@/app/actions/resources";

type ParsedRow = CsvResourceRow;

export default function ResourceCSVUploader({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { bulkImportResources } = useInventoryActions();
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined | null) {
    if (!file || importing || parsing) return;
    setRows([]);
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a CSV smaller than 5 MB.");
      return;
    }
    setError(null);
    setParsing(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParsing(false);
        if (result.errors.length) {
          setError(`CSV parse error: ${result.errors[0].message}`);
          setRows([]);
          return;
        }
        const parsed: ParsedRow[] = [];
        for (const [index, raw] of result.data.entries()) {
          const name = (raw.name ?? "").trim();
          const category = (raw.category ?? "").trim().toLowerCase();
          const quantity = Number(raw.quantity);
          const lat = Number(raw.lat);
          const lng = Number(raw.lng);
          const optional = {
            unit: raw.unit?.trim() || null,
            status: raw.status?.trim().toLowerCase() || "available",
            depotName: raw.depotName?.trim() || null,
          };
          const validation = resourceInputError({
            name,
            category,
            quantity,
            lat,
            lng,
            ...optional,
          });
          if (
            validation ||
            !raw.quantity?.trim() ||
            !raw.lat?.trim() ||
            !raw.lng?.trim()
          ) {
            setError(
              `Row ${index + 2}: ${validation ?? "Quantity, latitude and longitude are required."}`,
            );
            return;
          }
          parsed.push({ name, category, quantity, lat, lng, ...optional });
        }
        if (!parsed.length) {
          setError(
            "No valid rows found. Expected columns: name, category, quantity, lat, lng.",
          );
          setRows([]);
          return;
        }
        setRows(parsed);
        toast.success(
          `Parsed ${parsed.length} valid row${parsed.length === 1 ? "" : "s"}.`,
        );
      },
      error: (err) => {
        setParsing(false);
        setError(err.message);
        setRows([]);
      },
    });
  }

  async function confirmImport() {
    if (!rows.length) return;
    setImporting(true);
    setError(null);
    try {
      const result = await bulkImportResources(rows);
      if (!result.ok) throw new Error("Import failed. Check the connection and retry.");
      toast.success(`Imported ${result.count} resource${result.count === 1 ? "" : "s"}.`);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please retry.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="eoc-label text-accent">BULK UPLOAD</p>
          <h2 className="mt-1 text-lg font-bold">Import Resources</h2>
          <p className="mt-1 text-xs text-slate-500">
            Required: name, category, quantity, lat, lng. Optional: unit, status,
            depotName. Import adds new records.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={importing}
          className="rounded-md border border-border px-2 py-1 text-xs text-slate-400 hover:text-foreground"
        >
          Close
        </button>
      </div>

      {/* Drag-and-drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`mt-4 flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-eoc border-2 border-dashed px-4 text-center transition ${
          dragOver
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface-muted/40 text-slate-400"
        }`}
      >
        <span className="text-3xl" aria-hidden>
          📄
        </span>
        <p className="text-sm font-semibold">
          {parsing ? "Parsing…" : "Drag & drop a .csv here, or tap to browse"}
        </p>
        <p className="text-[11px] text-slate-500">name, category, quantity, lat, lng</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-severity-red-600 bg-severity-red-600/10 px-3 py-2 text-sm text-severity-red-400"
        >
          {error}
        </p>
      )}

      {/* Preview table — first 3 rows */}
      {rows.length > 0 && (
        <div className="mt-4">
          <p className="eoc-label mb-2">
            PREVIEW · {rows.length} ROW{rows.length === 1 ? "" : "S"} FOUND
          </p>
          <div className="overflow-x-auto rounded-eoc border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Lat</th>
                  <th className="px-3 py-2 font-semibold">Lng</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-semibold text-foreground">{r.name}</td>
                    <td className="px-3 py-2 capitalize text-slate-300">{r.category}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-300">
                      {r.quantity}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                      {r.lat}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                      {r.lng}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={() => void confirmImport()}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-glow transition hover:bg-sky-300 active:scale-95 disabled:opacity-50"
          >
            {importing ? "Importing…" : `Confirm Import (${rows.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
