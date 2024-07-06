from __future__ import annotations

import starlette.websockets

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

print("starting server")

from programs.p0 import infer_program_0, infer_program_4
from programs.p2 import infer_program_2, infer_program_2_b
from programs.p3 import infer_program_3
from utils.ws import create_send, strip
from utils.connection_state import handle_socket_connect, handle_socket_disconnect

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(sock: WebSocket):
    await sock.accept()

    conn_id = handle_socket_connect(sock)
    send = create_send(sock)

    while True:
        try:
            command = await sock.receive_text()
            command = command.strip()

            if command.startswith("P0:"):
                prompt = strip(command, "P0")
                send(infer_program_0(prompt, conn_id=conn_id))

            elif command.startswith("P2:"):
                strength = float(strip(command, "P2"))
                send(infer_program_2(strength, conn_id=conn_id))

            elif command.startswith("P2B:"):
                strength = float(strip(command, "P2B"))
                send(infer_program_2_b(strength, conn_id=conn_id))

            elif command == "P3":
                send(infer_program_3(" ", 5.5, conn_id=conn_id))

            elif command.startswith("P3B:"):
                prompt = strip(command, "P3B")
                send(infer_program_3(f"{prompt}, photorealistic", 5.5, conn_id=conn_id))

            elif command.startswith("P4:"):
                prompt = strip(command, "P4")
                send(infer_program_4(prompt, conn_id=conn_id))

            else:
                await sock.send_text(f"unknown command: {command}")
        except starlette.websockets.WebSocketDisconnect:
            handle_socket_disconnect(sock)

            # ADD DISCONNECTION LOGIC + TASK MAPPING HERE
            # MAKE SURE TO CANCEL INFERENCE TASK WHEN CLIENT IS DISCONNECTED.
            print("client disconnected.")
            break
