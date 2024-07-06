import uuid
from fastapi import WebSocket
from typing import Dict

connections: Dict[str, WebSocket] = {}


def get_is_connected(conn_id: str):
    global connections

    return conn_id in connections


def get_active_task(conn_id: str):
    global connections

    if conn_id not in connections:
        return

    conn = connections[conn_id]

    if not conn:
        return

    if conn.state.active_task:
        return conn.state.active_task


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


def register_task(conn_id: str):
    global connections

    if conn_id == None:
        print("warning! connection id should not be null!")
        return

    if conn_id not in connections:
        return

    sock = connections[conn_id]

    if not sock:
        return

    task_id = str(uuid.uuid4())
    sock.state.active_task = task_id
    return task_id
