from pathlib import Path
from urllib.parse import urlparse
import json
for filename in ['.env','.env.local']:
 values=dict(line.split('=',1) for line in Path(filename).read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
 db=urlparse(values.get('DATABASE_URL','').strip('"'))
 public=urlparse(values.get('NEXT_PUBLIC_SUPABASE_URL','').strip('"'))
 print(json.dumps({'file':filename,'databaseHost':db.hostname,'databasePort':db.port,'databasePasswordPresent':bool(db.password),'supabaseHost':public.hostname,'placeholderPassword':any(w in (db.password or '').lower() for w in ['your-password','your_password','replace','example'])}))
