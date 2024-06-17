import io
import asyncio

from api.utils.latents import latents_to_rgb

async def run_pipeline(create_pipeline):
  event = asyncio.Event()
  event_loop = asyncio.get_event_loop()

  def denoising_callback(pipe, step, timestep, callback_kwargs):
    latents = callback_kwargs["latents"]
    image = latents_to_rgb(latents).convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    img_bytes = buffer.getvalue()
    event_loop.call_soon_threadsafe(event.set)
    return callback_kwargs, img_bytes

  func = create_pipeline(denoising_callback)
  result = await event_loop.run_in_executor(None, func)
  image = result.images[0]
  buffer = io.BytesIO()
  image.save(buffer, format='JPEG')
  yield buffer.getvalue()