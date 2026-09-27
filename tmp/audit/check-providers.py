import json,urllib.request,urllib.error,concurrent.futures,re
from pathlib import Path
v=dict(re.findall(r'^([A-Z][A-Z0-9_]*)=(.*)$',Path('.env.local').read_text(),re.M))
cases=[('GROQ_API_KEY','https://api.groq.com/openai/v1','openai/gpt-oss-120b'),('GROQ_API_KEY_BACKUP','https://api.groq.com/openai/v1','openai/gpt-oss-120b'),('OPENROUTER_API_KEY','https://openrouter.ai/api/v1','openrouter/free'),('OPENROUTER_API_KEY_BACKUP','https://openrouter.ai/api/v1','openrouter/free'),('BLUESMINDS_API_KEY','https://api.bluesminds.com/v1','google/gemini-2.5-flash')]
def check(c):
 k,base,model=c
 req=urllib.request.Request(base+'/chat/completions',data=json.dumps({'model':model,'messages':[{'role':'user','content':'Reply with just: connection confirmed'}],'max_tokens':64}).encode(),headers={'Authorization':'Bearer '+v[k],'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=12) as r:
   d=json.load(r); t=d.get('choices',[{}])[0].get('message',{}).get('content'); return {'provider':k,'status':r.status,'textReceived':bool(t),'model':model}
 except urllib.error.HTTPError as e: return {'provider':k,'status':e.code,'model':model}
 except Exception as e: return {'provider':k,'status':type(e).__name__,'model':model}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: result=list(pool.map(check,cases))
Path('tmp/audit/provider-check.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result,indent=2))
