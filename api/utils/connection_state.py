import uuid
from fastapi import WebSocket
from typing import Dict

connections: Dict[str, WebSocket] = {}


def get_is_connected(conn_id: str):
    global connections

    return conn_id in connections


def handle_socket_connect(sock: WebSocket):
    global connections

    connection_id = str(uuid.uuid4())
    sock.state.connection_id = connection_id
    connections[connection_id] = sock

    return connection_id


def handle_socket_disconnect(sock: WebSocket):
    global connections

    if sock:
        del connections[sock.state.connection_id]
