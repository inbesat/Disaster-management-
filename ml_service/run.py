"""Run the ML service with a Windows-compatible event loop."""
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
