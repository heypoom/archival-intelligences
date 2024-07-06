import asyncio
from fastapi import WebSocket

from utils.connection_state import get_is_connected


def create_send(sock: WebSocket):
    conn_id = sock.state.connection_id

    def outer_send(generator):
        async def send_task():
            try:
                await sock.send_text("ready")

                async for out in generator:
                    if not get_is_connected(conn_id):
                        break

                    if out is None:
                        break

                    if isinstance(out, str):
                        await sock.send_text(out)
                    else:
                        await sock.send_bytes(out)

                await sock.send_text("done")
            except Exception as e:
                print("send error:", e)
                pass

        asyncio.create_task(send_task())

    return outer_send


def strip(command: str, key: str):
    return command.replace(key + ":", "").strip()
