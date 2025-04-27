import io
import os
import random
import time
from pathlib import Path
import asyncio

import modal

APP_NAME = "exhibition-text-to-image"
MODEL_NAME = "stabilityai/stable-diffusion-3.5-large-turbo"
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
    from diffusers import StableDiffusion3Pipeline
    from PIL import Image

CACHE_DIR = "/cache/sd3-turbo"
GENERATED_DIR = "/generated/with-noise"

cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)
generated_vol = modal.Volume.from_name("generated", create_if_missing=True)

# Constants for LORA
LORA_WEIGHTS = "heypoom/chuamiatee-1"
LORA_WEIGHT_NAME = "pytorch_lora_weights.safetensors"


@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol, GENERATED_DIR: generated_vol},
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class Inference:
    def __init__(self):
        self.lora_loaded = False

    @modal.enter()
    def initialize(self):
        print("initializing pipeline...")
        self.pipe = StableDiffusion3Pipeline.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,
        )
        print("pipeline initialized.")

    @modal.enter()
    def move_to_gpu(self):
        if self.pipe:
            print("Moving pipeline to GPU...")
            self.pipe.to("cuda")
            print("Pipeline on GPU.")
        else:
            print("Pipeline not initialized, cannot move to GPU.")

    def _ensure_lora_state(self, use_lora: bool):
        if use_lora and not self.lora_loaded:
            print("Loading LORA weights...")
            self.pipe.load_lora_weights(LORA_WEIGHTS, weight_name=LORA_WEIGHT_NAME)
            self.lora_loaded = True
        elif not use_lora and self.lora_loaded:
            print("Unloading LORA weights...")
            self.pipe.unload_lora_weights()
            self.lora_loaded = False

    @modal.method()
    def run(
        self,
        prompt: str,
        batch_size: int = 1,
        seed: int = None,
        width: int = 1360,
        height: int = 768,
        guidance_scale: float = 0.0,
        num_inference_steps: int = 10,
        use_lora: bool = False,
        final_only: bool = False,
    ) -> tuple[list[bytes], list[bytes]]:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")

        # Ensure LORA is in the correct state
        self._ensure_lora_state(use_lora)

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for: '{prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        # Callback function for real-time noise preview
        def step_callback(pipe, step_index, timestep, callback_kwargs):
            # Skip preview for final_only mode
            if final_only:
                return callback_kwargs

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
                num_images_per_prompt=batch_size,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
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
    min_containers=1,
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
                use_lora = False
                final_only = False

                if data == "P3":
                    prompt = " "
                    use_lora = True
                elif data.startswith("P3B:"):
                    prompt = f"{data[4:]}, photorealistic"
                    use_lora = True
                elif data == "P4":
                    prompt = " "
                    final_only = True
                elif data.startswith("P4:"):
                    base_prompt = data[3:].strip()
                    if base_prompt in [
                        "data researcher",
                        "crowdworker",
                        "big tech ceo",
                    ]:
                        prompt = f"{base_prompt}, photorealistic"
                    else:
                        prompt = base_prompt
                    final_only = True

                # Start inference in background
                call = inference.run.spawn(
                    prompt=prompt,
                    use_lora=use_lora,
                    final_only=final_only,
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
