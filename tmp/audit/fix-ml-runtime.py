from pathlib import Path
Path('ml_service/run.py').write_text('''"""Run the ML service with a Windows-compatible event loop."""
import asyncio
import os
import sys
import uvicorn

if __name__ == "__main__":
    config = uvicorn.Config("api:app", host=os.getenv("ML_HOST", "127.0.0.1"), port=int(os.getenv("ML_PORT", "8000")))
    server = uvicorn.Server(config)
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(server.serve())
        finally:
            loop.close()
    else:
        asyncio.run(server.serve())
''')
p=Path('lib/agents/nodes/intelligence-nodes.ts');s=p.read_text().replace('inventory: state.availableInventory','inventory: state.availableInventory, maxInventoryPercent: state.hoardingLimitPercent');p.write_text(s)
p=Path('tmp/audit/test-integrations.ts');s=p.read_text().replace("} catch { results.database = 'unavailable'; }", "} catch (error) { results.database = { status: 'unavailable', code: (error as {code?:string}).code ?? 'connection-error' }; }").replace('catch {results[name]={ok:false};}', 'catch (error) {results[name]={ok:false,error:error instanceof Error?error.message:"unavailable"};}');p.write_text(s)
print('Added a Windows-compatible ML startup command.')
