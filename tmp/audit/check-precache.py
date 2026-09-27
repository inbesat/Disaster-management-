from pathlib import Path
import re,urllib.request,concurrent.futures
s=Path('public/sw.js').read_text(encoding='utf-8')
urls=re.findall(r'url:"([^" ]+)"',s)
print('entries',len(urls))
def check(u):
 try:
  req=urllib.request.Request('http://localhost:3000'+u,method='HEAD')
  with urllib.request.urlopen(req,timeout=10) as r:return (u,r.status,r.headers.get('Content-Length'))
 except Exception as e:return (u,str(e),'')
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
 for u,status,size in ex.map(check,urls):
  if status!=200:print(u,status,size)
