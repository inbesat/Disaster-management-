from pathlib import Path
p=Path('app/actions/resources.ts');s=p.read_text(encoding='utf-8')
a=s.index('// Mock fallbacks')
b=s.index('/**\n * Fetch the full resource inventory',a)
s=s[:a]+s[b:]
a=s.index('// Seeded trail')
b=s.index('/**\n * Fetch the most recent resource movements',a)
s=s[:a]+s[b:]
s=s.replace(''' * Fetch the full resource inventory. Falls back to 5 realistic mock items
 * (spread across available/deployed/maintenance) if the DB is unreachable.''',''' * Fetch only stored resource inventory. Database failure is surfaced to callers.''')
s=s.replace(''' * Fetch pending field resource requests. Falls back to 3 mock requests
 * if the DB is unreachable.''',''' * Fetch only stored pending field resource requests.''')
s=s.replace(''' * Create a new field resource request. Falls back to a mock success (with a
 * fake id) if the DB is unreachable, so the mobile demo always works.''',''' * Create a field resource request and report whether it was saved.''')
s=s.replace(''' * Bulk-import resources from a parsed CSV. Falls back to a mock success on DB
 * failure so the uploader demo always completes.''',''' * Bulk-import resources from a parsed CSV. Database failures return ok=false.''')
s=s.replace(''' * when both rows exist. Returns true on success — and also on mock fallback,
 * so the demo UI always reflects an approval. Never throws.''',''' * when both rows exist. Returns true only after the approval is saved.''')
s=s.replace(''' * Create a single resource. Falls back to a mock id on DB failure so the Add
 * Resource form always "succeeds" during a demo without a live database.''',''' * Create a resource and return its saved ID.''')
s=s.replace(''' * UI can surface it, but still reports success when the row is a mock.''',''' * UI can surface the failure.''')
s=s.replace(''' * Delete a single resource. Falls back to success if the id is a mock row.''',''' * Delete a stored resource. Returns false if it cannot be removed.''')
s=s.replace(''' * Fetch the most recent resource movements. Falls back to the seeded trail
 * when the DB is unreachable or empty, so the feed always renders.''',''' * Fetch the most recent stored resource movements.''')
s=s.replace(''' * Record a resource movement (manual log / dispatch trail). Falls back to a
 * mock id when the DB is unreachable, so the form always "succeeds" during a
 * demo without a live database.''',''' * Record a resource movement (manual log / dispatch trail).''')
p.write_text(s,encoding='utf-8')
