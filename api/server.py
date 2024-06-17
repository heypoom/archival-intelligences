from __future__ import annotations

import starlette.websockets

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            command = await websocket.receive_text()
            command = command.strip()
            print(f"ws_command: {command}")
            if command.startswith("P0:"):
                prompt = command.replace("P0:", "").strip()
                await websocket.send_text(f"ready")
                for img_bytes in infer_program_zero(prompt):
                    if img_bytes == b'SENDING':
                        print("- SENDING -")
                        await websocket.send_text(f"sending")
                    elif img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    else:
                        print(f"sending image of len {len(img_bytes)}")
                        await websocket.send_bytes(img_bytes)
            elif command.startswith("P2:"):
                strength = float(command.replace("P2:", "").strip())
                await websocket.send_text(f"ready")
                for img_bytes in infer_P2(strength):
                    if img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(img_bytes)}")
                    await websocket.send_bytes(img_bytes)
            elif command.startswith("P2B:"):
                strength = float(command.replace("P2B:", "").strip())
                await websocket.send_text(f"ready")
                for img_bytes in denoise_program_2_b(strength):
                    if img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(img_bytes)}")
                    await websocket.send_bytes(img_bytes)
            elif command == "P3":
                await websocket.send_text(f"ready")
                for img_bytes in denoise_program_3(" "):
                    if img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(img_bytes)}")
                    await websocket.send_bytes(img_bytes)
            elif command.startswith("P3B:"):
                await websocket.send_text(f"ready")
                prompt = command.replace("P3B:", "").strip()
                for img_bytes in denoise_program_3(prompt):
                    if img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(img_bytes)}")
                    await websocket.send_bytes(img_bytes)
            elif command.startswith("P4:"):
                prompt = command.replace("P4:", "").strip()
                await websocket.send_text(f"ready")
                for img_bytes in denoise_program_4(prompt):
                    if img_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(img_bytes)}")
                    await websocket.send_bytes(img_bytes)
            else:
                await websocket.send_text(f"unknown command: {command}")
        except starlette.websockets.WebSocketDisconnect:
            # ADD DISCONNECTION LOGIC + TASK MAPPING HERE
            # MAKE SURE TO CANCEL INFERENCE TASK WHEN CLIENT IS DISCONNECTED.
            print("client disconnected.")
            break
