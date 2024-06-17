import io
import asyncio

from utils.latents import latents_to_rgb


async def denoise(run):
    queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def on_step_end(pipe, step, timestep, callback_kwargs):
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        img_bytes = buffer.getvalue()
        loop.call_soon_threadsafe(queue.put_nowait, f"p:s={step}:t={timestep}")
        loop.call_soon_threadsafe(queue.put_nowait, img_bytes)
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


async def return_image(get_image):
    event_loop = asyncio.get_event_loop()
    result = await event_loop.run_in_executor(None, get_image)
    image = result.images[0]
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    yield buffer.getvalue()
    return
