import io
import os
import random
import time
from pathlib import Path
import asyncio

import modal

APP_NAME = "exhibition-image-to-image"
MODEL_NAME = "runwayml/stable-diffusion-v1-5"
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
        "numpy",
        "Pillow",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

with image.imports():
    import torch
    from diffusers import StableDiffusionImg2ImgPipeline
    from PIL import Image

CACHE_DIR = "/cache/sd-v1-5"
GENERATED_DIR = "/generated/image-to-image"

cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)
generated_vol = modal.Volume.from_name("generated", create_if_missing=True)

# Constants for image-to-image
POEM_OF_MALAYA_SIZE = (960, 800)
PROMPT_2 = "painting like an epic poem of malaya"
PROMPT_2B = "crowd of people in a public space"
GUIDANCE_SCALE_2B = 8.5
STEPS = 50


@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol, GENERATED_DIR: generated_vol},
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class Inference:
    def __init__(self):
        self.malaya_image = None

    @modal.enter()
    def initialize(self):
        print("initializing pipeline...")
        self.pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,
        )
        print("pipeline initialized.")

        # Load and resize the Malaya image
        print("loading Malaya image...")
        malaya_path = Path("/root/malaya.png")
        if not malaya_path.exists():
            raise FileNotFoundError("malaya.png not found in container")
        self.malaya_image = (
            Image.open(malaya_path).resize(POEM_OF_MALAYA_SIZE).convert("RGB")
        )
        print("Malaya image loaded and resized.")

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
        strength: float = 0.75,
        guidance_scale: float = 7.5,
        seed: int = None,
        width: int = 960,
        height: int = 800,
        num_inference_steps: int = STEPS,
    ) -> tuple[list[bytes], list[bytes]]:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")
        if not self.malaya_image:
            raise RuntimeError("Malaya image not loaded.")

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for: '{prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        # Callback function for real-time noise preview
        def step_callback(pipe, step_index, timestep, callback_kwargs):
            latents = callback_kwargs["latents"]

            # Send progress update
            progress_msg = f"p:s={step_index}:t={timestep}"
            try:
                generation_queue.put(progress_msg)
            except Exception as e:
                print(f"Warning: Failed to put progress update on queue: {e}")

            # Decode latents to preview image
            try:
                with torch.no_grad():
                    latent_to_decode = latents[0:1]
                    scaled_latents = latent_to_decode / pipe.vae.config.scaling_factor
                    image_tensor = pipe.vae.decode(
                        scaled_latents.to(pipe.vae.dtype), return_dict=False
                    )[0]

                    # Process tensor to PIL Image
                    image = (image_tensor / 2 + 0.5).clamp(0, 1)
                    image = image.cpu().permute(0, 2, 3, 1).float().numpy()
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
                image=self.malaya_image,
                strength=strength,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                generator=generator,
                callback_on_step_end=step_callback,
                callback_on_step_end_tensor_inputs=["latents"],
                width=width,
                height=height,
            ).images
            print("inference complete!")
        finally:
            # Signal completion
            if generation_queue is not None:
                try:
                    print("putting completion signal (None) onto queue.")
                    generation_queue.put(None)
                except Exception as e:
                    print(f"Warning: Failed to put completion signal on queue: {e}")

        # Convert final images to bytes
        image_output = []
        for image in images:
            with io.BytesIO() as buf:
                image.save(buf, format="PNG")
                image_output.append(buf.getvalue())

        print(f"Inference complete. Generated {len(image_output)} final images.")
        return image_output


@app.function(
    volumes={GENERATED_DIR: generated_vol},
    timeout=650,
    min_containers=0,
    max_containers=3,
)
@modal.asgi_app()
def endpoint():
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.responses import JSONResponse

    web_app = FastAPI()
    output_dir = Path(GENERATED_DIR)
    output_dir.mkdir(exist_ok=True)

    inference = Inference()

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
        await websocket.send_text("websocket connected!")

        try:
            while True:
                data = await websocket.receive_text()

                if data == "ping":
                    await websocket.send_text("pong")
                    continue

                run_id = int(time.time())
                await websocket.send_text(
                    f"Received prompt: '{data}'. Starting generation (Run ID: {run_id})..."
                )

                # Parse the command and prepare prompt
                prompt = data.strip()
                strength = 0.75
                guidance_scale = 7.5

                if data == "P2":
                    prompt = PROMPT_2
                elif data.startswith("P2:"):
                    prompt = data[3:].strip()
                elif data == "P2B":
                    prompt = PROMPT_2B
                    guidance_scale = GUIDANCE_SCALE_2B
                elif data.startswith("P2B:"):
                    prompt = f"{data[4:]}, {PROMPT_2B}"
                    guidance_scale = GUIDANCE_SCALE_2B

                # Start inference in background
                call = inference.run.spawn(
                    prompt=prompt,
                    strength=strength,
                    guidance_scale=guidance_scale,
                )

                print(f"submitted inference job for run {run_id}")

                # Listen for queue updates
                async def listen_for_updates():
                    while True:
                        try:
                            signal = generation_queue.get()
                            if signal is None:
                                await websocket.send_text(
                                    "preview generation finished."
                                )
                                break
                            elif isinstance(signal, str):
                                await websocket.send_text(signal)
                            elif isinstance(signal, bytes):
                                await websocket.send_bytes(signal)
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            print(f"Error reading from queue: {e}")
                            break

                listener_task = asyncio.create_task(listen_for_updates())

                # Wait for inference to complete
                try:
                    images = call.get()
                    print(f"inference result received for run {run_id}")

                    # Save and send final images
                    run_output_path = Path(output_dir / f"run_{run_id}/")
                    run_output_path.mkdir(exist_ok=True)

                    for i, image_bytes in enumerate(images):
                        output_path = run_output_path / f"output_{i:02d}.png"
                        output_path.write_bytes(image_bytes)
                        await websocket.send_bytes(image_bytes)

                    await websocket.send_text("done")

                except Exception as e:
                    print(f"Error during inference execution: {e}")
                    await websocket.send_text(f"Error during generation: {e}")
                    listener_task.cancel()
                    continue

                # Wait for listener task to finish
                try:
                    await asyncio.wait_for(listener_task, timeout=10.0)
                    print("Listener task finished.")
                except asyncio.TimeoutError:
                    print("Warning: Listener task did not finish quickly.")
                except asyncio.CancelledError:
                    print("Listener task was cancelled.")

        except WebSocketDisconnect:
            print("Client disconnected")
            if "listener_task" in locals() and not listener_task.done():
                listener_task.cancel()
                try:
                    await listener_task
                except asyncio.CancelledError:
                    print("Listener task cancelled due to client disconnect.")
        except Exception as e:
            print(f"An error occurred in the websocket handler: {e}")
            try:
                await websocket.send_text(f"Server error: {e}")
                await websocket.close(code=1011)
            except Exception:
                pass
        finally:
            print("Websocket connection closed.")

    return web_app
