import json,urllib.request,urllib.error,time
cases=[{'messages':[{'role':'user','content':'In one sentence, explain why disaster evacuation drills are useful.'}],'responseFormat':'json'}, {'messages':[{'id':'1','role':'user','parts':[{'type':'text','text':'Give a short family earthquake preparedness checklist.'}]}]}]
results=[]
for case in cases:
 start=time.time()
 try:
  req=urllib.request.Request('http://localhost:3000/api/chat',data=json.dumps(case).encode(),headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=150) as r: results.append({'status':r.status,'duration':round(time.time()-start,1),'body':r.read().decode()[:3500]})
 except urllib.error.HTTPError as e: results.append({'status':e.code,'body':e.read().decode()[:500]})
 except Exception as e: results.append({'error':str(e)})
from pathlib import Path
Path('tmp/audit/chat-live.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
