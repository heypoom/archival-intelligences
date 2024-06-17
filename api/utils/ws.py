from fastapi import WebSocket


def create_send(websocket: WebSocket):
    async def send(generator):
        await websocket.send_text("ready")

        async for out in generator:
            if isinstance(out, str):
                await websocket.send_text(out)
            else:
                await websocket.send_bytes(out)

        await websocket.send_text("done")

    return send


def strip(command: str, key: str):
    return command.replace(key + ":", "").strip()
