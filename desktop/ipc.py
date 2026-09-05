"""한 번만 실행. 두 번째 실행은 이미 떠 있는 창만 띄우고 종료한다."""
from __future__ import annotations

import socket
import threading


def notify_existing(port: int) -> bool:
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=0.35)
        s.sendall(b"SHOW\n")
        s.close()
        return True
    except OSError:
        return False


def serve(port: int, on_show) -> None:
    def loop() -> None:
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            srv.bind(("127.0.0.1", port))
        except OSError:
            return
        srv.listen(4)
        while True:
            try:
                conn, _ = srv.accept()
                data = conn.recv(64)
                conn.close()
                if data.startswith(b"SHOW") and on_show:
                    on_show()
            except OSError:
                break

    threading.Thread(target=loop, daemon=True).start()
