from pathlib import Path
p=Path('app/actions/resources.ts');s=p.read_text(encoding='utf-8')
s=s.replace('if (!rows.length) return MOCK_INVENTORY;','if (!rows.length) return [];')
s=s.replace('if (!rows.length) return MOCK_REQUESTS;','if (!rows.length) return [];')
s=s.replace('if (!rows.length) return MOCK_MOVEMENTS;','if (!rows.length) return [];')
s=s.replace('console.warn("[resources] getInventory fell back to mock data.", error);\n    return MOCK_INVENTORY;','console.error("[resources] inventory unavailable", error);\n    throw new Error("Resource inventory is unavailable");')
s=s.replace('console.warn("[resources] getPendingRequests fell back to mock data.", error);\n    return MOCK_REQUESTS;','console.error("[resources] pending requests unavailable", error);\n    throw new Error("Resource requests are unavailable");')
s=s.replace('console.warn("[resources] getResourceMovements fell back to mock data.", error);\n    return MOCK_MOVEMENTS.slice(0, limit);','console.error("[resources] movements unavailable", error);\n    throw new Error("Resource movements are unavailable");')
s=s.replace('console.warn("[resources] submitResourceRequest fell back to mock success.", error);\n    return { ok: true, id: `mock-${Date.now()}` };','console.error("[resources] request could not be saved", error);\n    return { ok: false, id: "", error: "Resource request could not be saved" };')
s=s.replace('console.warn("[resources] bulkImportResources fell back to mock success.", error);\n    return { ok: true, count: rows.length };','console.error("[resources] bulk import failed", error);\n    return { ok: false, count: 0 };')
s=s.replace('console.warn("[resources] approveRequest fell back to mock success.", error);\n    return true;','console.error("[resources] approval failed", error);\n    return false;')
s=s.replace('console.warn("[resources] addResource fell back to mock success.", error);\n    return { ok: true, id: `mock-${Date.now()}` };','console.error("[resources] resource could not be saved", error);\n    return { ok: false, id: "", error: "Resource could not be saved" };')
s=s.replace('''    // Mock rows (prefixed `mock-`/`res-`) don't exist in the DB — treat as
    // removed so the demo table can clear an item without a live database.
    return id.startsWith("mock-") || id.startsWith("res-");''','''    return false;''')
s=s.replace('console.warn("[resources] logResourceMovement fell back to mock success.", error);\n    return { ok: true, id: `mock-${Date.now()}` };','console.error("[resources] movement could not be saved", error);\n    return { ok: false, id: "" };')
p.write_text(s,encoding='utf-8')
p=Path('components/dashboard/LowStockWidget.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('  const [loading, setLoading] = useState(true);','  const [loading, setLoading] = useState(true);\n  const [unavailable, setUnavailable] = useState(false);')
s=s.replace('''      .catch((error) => {
        console.error("Failed to load inventory:", error);
      })''','''      .catch((error) => {
        console.error("Failed to load inventory:", error);
        if (active) setUnavailable(true);
      })''')
s=s.replace('''      {!loading && shortages.length === 0 && (''','''      {unavailable && <p role="status" className="mt-3 text-sm text-amber-300">Inventory is unavailable. Stock levels cannot be verified.</p>}

      {!loading && !unavailable && shortages.length === 0 && (''')
s=s.replace('''      {shortages.map((s) => (''','''      {!unavailable && shortages.map((s) => (''')
p.write_text(s,encoding='utf-8')
