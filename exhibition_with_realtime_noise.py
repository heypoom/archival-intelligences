import io
import os
import random
import time
from pathlib import Path
import asyncio

import modal

APP_NAME = "exhibition-with-realtime-noise"
MODEL_NAME = ("stabilityai/stable-diffusion-3.5-large-turbo",)
app = modal.App(APP_NAME)

generation_queue = modal.Queue.from_name("generation_queue", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "accelerate==0.33.0",
        "diffusers==0.31.0",
        "fastapi[standard]==0.115.4",
        "huggingface-hub[hf_transfer]==0.25.2",
        "sentencepiece==0.2.0",
        "torch==2.5.1",
        "torchvision==0.20.1",
        "transformers~=4.44.0",
        "numpy",  # Explicitly add numpy, good practice
        "Pillow",  # Explicitly add Pillow
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

with image.imports():
    import diffusers
    import torch
    from diffusers import StableDiffusion3Pipeline
    from diffusers.utils import make_image_grid
    import numpy as np
    from PIL import Image

CACHE_DIR = "/cache/sd3-turbo"
GENERATED_DIR = "/generated/with-noise"

cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)
generated_vol = modal.Volume.from_name("generated", create_if_missing=True)

# "adamo1139/stable-diffusion-3.5-large-turbo-ungated"
# revision="9ad870ac0b0e5e48ced156bb02f85d324b7275d2"

# Define a Queue specifically for this app to avoid potential conflicts
# If you need multiple independent queues, you might structure this differently,
# but for passing updates from one function call back, creating it dynamically works.
# UpdateQueue = modal.Queue(app_name=APP_NAME) # No need for global queue here


@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol, GENERATED_DIR: generated_vol},
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class Inference:

    @modal.enter()
    def initialize(self):
        print("initializing pipeline...")
        # Ensure float32 for VAE on CPU if needed during callback preview
        self.pipe = StableDiffusion3Pipeline.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,  # Keep bfloat16 for inference
        )
        # Move VAE temporarily to CPU with float32 for decoding previews if GPU memory is tight
        # Or handle decoding carefully on GPU. Let's try keeping VAE on GPU first.
        print("pipeline initialized.")

    # Separating GPU move from initialization can sometimes help with Modal startup
    @modal.enter()
    def move_to_gpu(self):
        if self.pipe:
            print("Moving pipeline to GPU...")
            self.pipe.to("cuda")
            print("Pipeline on GPU.")
        else:
            print("Pipeline not initialized, cannot move to GPU.")

    @modal.method()
    def run(
        self,
        prompt: str,
        batch_size: int = 1,  # Start with batch_size 1 for simplicity with preview
        seed: int = None,
    ) -> tuple[list[bytes], list[bytes]]:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for: '{prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        preview_images = []
        preview_count = 0  # Keep track separately for queue updates

        # Callback function to save intermediate steps and send updates
        def step_callback(pipe, step_index, timestep, callback_kwargs):
            nonlocal preview_count  # Modify the outer counter
            latents = callback_kwargs["latents"]

            # Send progress update in the format expected by frontend
            progress_msg = f"p:s={step_index}:t={timestep}"
            try:
                generation_queue.put(progress_msg)
            except Exception as e:
                print(f"Warning: Failed to put progress update on queue: {e}")

            # Decode the latents to a preview image (only for the first image in batch)
            try:
                with torch.no_grad():
                    latent_to_decode = latents[0:1]  # Keep batch dim
                    scaled_latents = latent_to_decode / pipe.vae.config.scaling_factor
                    image_tensor = pipe.vae.decode(
                        scaled_latents.to(pipe.vae.dtype), return_dict=False
                    )[0]

                    # Process tensor to PIL Image
                    image = (image_tensor / 2 + 0.5).clamp(0, 1)
                    image = image.cpu().permute(0, 2, 3, 1).float().numpy()  # BHWC
                    image = (image * 255).round().astype("uint8")

                    preview_image = Image.fromarray(image[0])

                    # Save preview image to bytes
                    with io.BytesIO() as buf:
                        preview_image.save(buf, format="JPEG", quality=75)
                        preview_bytes = buf.getvalue()
                        try:
                            generation_queue.put(preview_bytes)
                        except Exception as e:
                            print(f"Warning: Failed to put preview image on queue: {e}")

            except Exception as e:
                print(f"Error during preview generation step {step_index}: {e}")

            return callback_kwargs

        # Run the pipeline with callback
        try:
            images = self.pipe(
                prompt=prompt,
                num_images_per_prompt=batch_size,
                num_inference_steps=10,  # SD3 Turbo needs few steps
                guidance_scale=0.0,  # SD3 Turbo uses 0.0
                generator=generator,
                callback_on_step_end=step_callback,
                callback_on_step_end_tensor_inputs=[
                    "latents"
                ],  # Ensure latents are passed
                width=1360,  # Adjust as needed
                height=768,  # Adjust as needed
            ).images
            print("inference complete!")
        finally:
            # --- Signal completion via Queue ---
            if generation_queue is not None:
                try:
                    print("putting completion signal (None) onto queue.")
                    generation_queue.put(None)  # Use None as completion signal
                except Exception as e:
                    print(f"Warning: Failed to put completion signal on queue: {e}")
            # ------------------------------------

        # Convert final images to bytes
        image_output = []
        for image in images:
            with io.BytesIO() as buf:
                image.save(buf, format="PNG")
                image_output.append(buf.getvalue())

        # No need to explicitly empty cache here unless facing memory issues between runs
        # torch.cuda.empty_cache()

        print(
            f"Inference complete. Generated {len(image_output)} final images and {len(preview_images)} previews."
        )
        return image_output, preview_images


# Separate function for the ASGI app
@app.function(
    volumes={GENERATED_DIR: generated_vol},
    timeout=650,  # Slightly longer timeout for websocket handling
    min_containers=1,  # Keep one instance warm for faster websocket connections
    max_containers=3,
)
@modal.asgi_app()
def endpoint():
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.responses import JSONResponse

    web_app = FastAPI()  # Use a different variable name
    output_dir = Path(GENERATED_DIR)
    output_dir.mkdir(exist_ok=True)

    inference = Inference()  # Create an instance of the Inference class

    @web_app.get("/")
    async def get():
        return JSONResponse(
            {
                "status": "ok",
                "timestamp": int(time.time()),
            }
        )

    @web_app.websocket("/ws")
    async def websocket_handler(websocket: WebSocket) -> None:
        await websocket.accept()

        websocket.send_text("websocket connected!")

        try:
            while True:
                data = await websocket.receive_text()

                # Handle ping message
                if data == "ping":
                    await websocket.send_text("pong")
                    continue

                run_id = int(time.time())
                await websocket.send_text(
                    f"Received prompt: '{data}'. Starting generation (Run ID: {run_id})..."
                )

                prompt = data.strip()

                # --- Task to listen for queue updates ---
                async def listen_for_updates():
                    while True:
                        try:
                            # Wait for the next update from the queue
                            signal = generation_queue.get()
                            if signal is None:  # Check for completion signal
                                print("received completion signal from queue.")
                                await websocket.send_text(
                                    "preview generation finished."
                                )
                                break  # Exit the listener loop
                            elif isinstance(signal, int):
                                await websocket.send_text(f"preview count: {signal}")
                            # Add handling for other message types (like errors) if needed
                            # elif isinstance(update, dict) and 'error' in update:
                            #     await websocket.send_text(f"Error during preview: {update['error']}")

                        except WebSocketDisconnect:
                            print("WebSocket disconnected while listening to queue.")
                            break  # Stop listening if client disconnects
                        except Exception as e:
                            print(f"Error reading from queue or sending update: {e}")
                            # Decide whether to break or continue based on error type
                            await websocket.send_text(f"Error processing update: {e}")
                            break  # Exit loop on unexpected errors

                # --- Start the inference in the background ---
                # Use .spawn() to run remotely without blocking
                call = inference.run.spawn(prompt, batch_size=1)

                print(
                    f"submitted inference job for run {run_id}. Call ID: {call.object_id}"
                )

                # --- Start the queue listener task ---
                listener_task = asyncio.create_task(listen_for_updates())

                # --- Wait for the main inference call to finish ---
                try:
                    print(f"Waiting for inference result for run {run_id}...")
                    # This will block until inference.run completes and returns
                    images, preview_images = call.get()  # Retrieve result
                    print(f"inference result received for run {run_id}.")

                    # Send completion signal
                    await websocket.send_text("done")

                    # Send final image
                    if images:
                        with io.BytesIO() as buf:
                            images[0].save(buf, format="JPEG", quality=95)
                            await websocket.send_bytes(buf.getvalue())

                except Exception as e:
                    print(f"Error during inference execution: {e}")
                    await websocket.send_text(f"Error during generation: {e}")
                    # Ensure listener task is cancelled if main task fails
                    listener_task.cancel()
                    continue  # Skip saving if inference failed

                # --- Ensure listener task finishes (it should exit on None) ---
                try:
                    await asyncio.wait_for(
                        listener_task, timeout=10.0
                    )  # Wait briefly for clean exit
                    print("Listener task finished.")
                except asyncio.TimeoutError:
                    print(
                        "Warning: Listener task did not finish quickly after completion signal."
                    )
                except asyncio.CancelledError:
                    print("Listener task was cancelled.")

                # --- Process and save final results ---
                run_output_path = Path(output_dir / f"run_{run_id}/")
                run_output_path.mkdir(exist_ok=True)

                # Optionally save previews to disk (already sent count in real-time)
                # for i, preview_bytes in enumerate(preview_images):
                #     preview_path = run_output_path / f"preview_{i:02d}.jpg" # Save as jpg
                #     preview_path.write_bytes(preview_bytes)
                #     # Don't send text for each saved preview, clutters output
                # await websocket.send_text(f"Saved {len(preview_images)} preview images to disk.")

                # Save final images and send the first one back via WebSocket (optional)
                for i, image_bytes in enumerate(images):
                    output_path = run_output_path / f"output_{i:02d}.png"
                    output_path.write_bytes(image_bytes)
                    # await websocket.send_text(f"Saved final image: {output_path.name}")

                    # Example: Send the first final image back as a data URL
                    # if i == 0:
                    #     import base64

                    #     img_b64 = base64.b64encode(image_bytes).decode("utf-8")
                    #     await websocket.send_text(f"data:image/png;base64,{img_b64}")

        except WebSocketDisconnect:
            print("Client disconnected")
            # Clean up: cancel listener task if it's still running (though it should stop on disconnect)
            if "listener_task" in locals() and not listener_task.done():
                listener_task.cancel()
                try:
                    await listener_task  # Allow cancellation to propagate
                except asyncio.CancelledError:
                    print("Listener task cancelled due to client disconnect.")
        except Exception as e:
            print(f"An error occurred in the websocket handler: {e}")
            # Try to inform the client before closing
            try:
                await websocket.send_text(f"Server error: {e}")
                await websocket.close(code=1011)  # Internal Error
            except Exception:
                pass  # Ignore errors during close after another error
        finally:
            print("Websocket connection closed.")
            # Ensure queue resources are potentially cleaned up (Modal might handle this)
            # Explicitly delete or let garbage collection handle 'update_queue'

    return web_app  # Return the FastAPI app instance
