import io
import asyncio

from utils.connection_state import get_active_task, get_is_connected, register_task
from utils.latents import latents_to_rgb
from utils.lora import init_chuamiatee


async def denoise(run, final_only=False, is_chuamiatee=False, conn_id=None):
    queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    task_id = register_task(conn_id)
    print(f"denoise(conn={conn_id}, task={task_id})")

    init_chuamiatee(is_chuamiatee)

    def on_step_end(pipe, step, timestep, callback_kwargs):
        is_connected = get_is_connected(conn_id)
        active_task_id = get_active_task(conn_id)
        task_changed = task_id != active_task_id
        should_interrupt = not is_connected or task_changed

        print(
            f"step_end(s: {step}, ts: {timestep}, task_id: {task_id}, active_task_id: {active_task_id}, conn_id: {conn_id}, connected: {is_connected}, changed: {task_changed})"
        )

        if should_interrupt:
            reason = "???"
            if not is_connected:
                reason = "disconnected"
            elif task_changed:
                reason = "task changed"
            print(f"int interrupt: {reason}, conn={conn_id}, task={task_id}")
            pipe._interrupt = True

        loop.call_soon_threadsafe(queue.put_nowait, f"p:s={step}:t={timestep}")

        if not final_only or should_interrupt:
            buffer = io.BytesIO()
            latents = callback_kwargs["latents"]
            latents_to_rgb(latents).convert("RGB").save(buffer, format="JPEG")
            loop.call_soon_threadsafe(queue.put_nowait, buffer.getvalue())

        if should_interrupt:
            loop.call_soon_threadsafe(queue.put_nowait, None)

        return callback_kwargs

    def start_denoise():
        result = run(on_step_end)
        image = result.images[0]
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        loop.call_soon_threadsafe(queue.put_nowait, buffer.getvalue())
        loop.call_soon_threadsafe(queue.put_nowait, None)

    task = loop.run_in_executor(None, start_denoise)

    while not task.done():
        out = await queue.get()
        yield out
        queue.task_done()
        if out is None:
            break

    return
