import io
import asyncio

from utils.latents import latents_to_rgb
from utils.lora import init_chuamiatee


async def denoise(run, final_only=False, is_chuamiatee=False):
    queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    init_chuamiatee(is_chuamiatee)

    def on_step_end(pipe, step, timestep, callback_kwargs):
        loop.call_soon_threadsafe(queue.put_nowait, f"p:s={step}:t={timestep}")

        if not final_only:
            buffer = io.BytesIO()
            latents = callback_kwargs["latents"]
            latents_to_rgb(latents).convert("RGB").save(buffer, format="JPEG")
            loop.call_soon_threadsafe(queue.put_nowait, buffer.getvalue())

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
