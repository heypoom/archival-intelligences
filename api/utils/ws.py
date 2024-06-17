async def send(websocket: WebSocket, generator):
    await websocket.send_text("ready")
    
    async for image_bytes in generator:
        if image_bytes:
            await websocket.send_bytes(image_bytes)
        else:
            await websocket.send_text("done")

def strip(command: str, key: str):
    return command.replace(key + ":", "").strip()
