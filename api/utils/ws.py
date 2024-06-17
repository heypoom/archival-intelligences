from fastapi import WebSocket


def create_send(websocket: WebSocket):
    async def send(generator):
        await websocket.send_text("ready")

        async for image_bytes in generator:
            if image_bytes:
                await websocket.send_bytes(image_bytes)

        print("send > done")
        await websocket.send_text("done")

    return send


def strip(command: str, key: str):
    return command.replace(key + ":", "").strip()
