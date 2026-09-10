import socket
import threading
import time
import webbrowser

import uvicorn
from backend.main import app
import backend.features.comparison.router
import backend.features.dataset.router
import backend.features.hub.router
import backend.features.inference.router
import backend.features.layer.router
import backend.features.profile.router
import backend.features.simulator.router
import backend.features.transect.router
import backend.features.volume.router


def available_port(start: int = 8000) -> int:
    for port in range(start, start + 100):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
        return port
    raise RuntimeError("No available local port found.")


def open_browser(port: int):
    time.sleep(1.5)
    webbrowser.open(f"http://127.0.0.1:{port}/")


if __name__ == "__main__":
    port = available_port()
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )
