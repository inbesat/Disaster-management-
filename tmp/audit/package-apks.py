from pathlib import Path
import shutil,hashlib,json
art=Path('artifacts');art.mkdir(exist_ok=True)
items=[]
for src,name in [('android/app/build/outputs/apk/debug/app-debug.apk','safesphere.apk'),('native-android/app/build/outputs/apk/debug/app-debug.apk','safesphere-field-ops.apk')]:
 dest=art/name;shutil.copy2(src,dest);shutil.copy2(src,Path('public')/name)
 items.append({'name':name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'signing':'debug','backend':'https://safesphere0.netlify.app'})
(art/'apk-manifest.json').write_text(json.dumps(items,indent=2))
p=Path('app/download/page.tsx');s=p.read_text().replace('~25 MB',f'{items[0]["bytes"]/1048576:.1f} MB').replace('~73.6 MB',f'{items[1]["bytes"]/1048576:.1f} MB').replace('First responders & extreme offline survival','For responders and offline preparation').replace('Full offline operation: 61-rule AI (Nova), TFLite triage classifier, offline MapLibre maps, GPS SOS with countdown, family distances, report triage — zero internet required.','Cloud AI when connected; clearly marked offline guidance and cached field tools when disconnected. Maps require previously downloaded data. Sending SOS reports requires connectivity.').replace('"61-rule offline AI (Nova)"','"Cloud AI + offline guidance"').replace('"Zero-internet operation"','"Cached data when offline"');s=s.replace('      {/* Android APK edition cards */}','      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-amber-200">Android test builds. Online features connect to the deployed SafeSphere server; server updates require a separate deployment.</p>\n\n      {/* Android APK edition cards */}');p.write_text(s)
print(json.dumps(items,indent=2))
