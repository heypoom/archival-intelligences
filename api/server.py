from __future__ import annotations

import starlette.websockets

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from programs.p0 import infer_program_0, infer_program_4
from programs.p2 import infer_program_2, infer_program_2_b
from programs.p3 import infer_program_3
from utils.ws import create_send, strip

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    send = create_send(websocket)

    while True:
        try:
            command = await websocket.receive_text()
            command = command.strip()

            if command.startswith("P0:"):
                prompt = strip(command, "P0")
                await send(infer_program_0(prompt))

            elif command.startswith("P2:"):
                strength = float(strip(command, "P2"))
                await send(infer_program_2(strength))

            elif command.startswith("P2B:"):
                strength = float(strip(command, "P2B"))
                await send(infer_program_2_b(strength))

            elif command == "P3":
                await send(infer_program_3(" ", 5.5))

            elif command.startswith("P3B:"):
                prompt = strip(command, "P3B")
                await send(infer_program_3(prompt, 5.5))

            elif command.startswith("P4:"):
                prompt = strip(command, "P4")
                await send(infer_program_4(prompt))

            else:
                await websocket.send_text(f"unknown command: {command}")
        except starlette.websockets.WebSocketDisconnect:
            # ADD DISCONNECTION LOGIC + TASK MAPPING HERE
            # MAKE SURE TO CANCEL INFERENCE TASK WHEN CLIENT IS DISCONNECTED.
            print("client disconnected.")
            break
