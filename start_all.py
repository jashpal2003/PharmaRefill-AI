"""
start_all.py — Unified Launcher for PharmaRefill AI (RxTriage).
Starts both the FastAPI backend gateway (port 8000) and Next.js frontend (port 3000).
"""
import subprocess
import sys
import os
import time
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def run():
    print("=" * 65)
    print("PHARMAREFILL AI (RxTriage) — UNIFIED LAUNCHER")
    print("=" * 65)
    print("1. Launching FastAPI Real-Time Gateway on http://127.0.0.1:8000 ...")
    backend_process = subprocess.Popen(
        [sys.executable, "run_server.py"],
        cwd=BACKEND_DIR
    )

    time.sleep(2)

    print("2. Launching Next.js Pharmacist Live Operations Cockpit on http://localhost:3000 ...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=FRONTEND_DIR
    )

    print("\n" + "=" * 65)
    print("SYSTEM OPERATIONAL:")
    print("• Pharmacist Cockpit: http://localhost:3000")
    print("• Backend REST & WebSockets: http://127.0.0.1:8000")
    print("• Health Endpoint: http://127.0.0.1:8000/health")
    print("• Press Ctrl+C to terminate both servers cleanly.")
    print("=" * 65 + "\n")

    def signal_handler(sig, frame):
        print("\nShutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        backend_process.terminate()
        frontend_process.terminate()
        print("Shutdown complete.")

if __name__ == "__main__":
    run()
