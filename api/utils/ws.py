from fastapi import WebSocket

from utils.connection_state import get_is_connected


def create_send(sock: WebSocket):
    conn_id = sock.state.connection_id

    async def send(generator):
        await sock.send_text("ready")

        async for out in generator:
            if not get_is_connected(conn_id):
                break

            if isinstance(out, str):
                await sock.send_text(out)
            else:
                await sock.send_bytes(out)

        await sock.send_text("done")

    return send


def strip(command: str, key: str):
    return command.replace(key + ":", "").strip()
