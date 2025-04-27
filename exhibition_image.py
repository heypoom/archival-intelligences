import io
import os
import random
import time
import asyncio
from pathlib import Path

import modal

APP_NAME = "exhibition-image-simple"
MODEL_NAME = "stabilityai/stable-diffusion-3.5-large-turbo"

app = modal.App(APP_NAME)

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

CACHE_DIR = "/cache/sd3-turbo"
GENERATED_DIR = "/generated/oneshot"

cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)
generated_vol = modal.Volume.from_name("generated", create_if_missing=True)


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
        width: int = 1360,
        height: int = 768,
        guidance_scale: float = 0.0,
        num_inference_steps: int = 10,
    ) -> tuple[list[bytes], list[bytes]]:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for: '{prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        # Run the pipeline with callback
        images = self.pipe(
            prompt=prompt,
            num_images_per_prompt=batch_size,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
            width=width,
            height=height,
        ).images

        # Convert final images to bytes
        image_output = []

        for image in images:
            with io.BytesIO() as buf:
                image.save(buf, format="PNG")
                image_output.append(buf.getvalue())

        # No need to explicitly empty cache here unless facing memory issues between runs
        # torch.cuda.empty_cache()

        print(f"inference complete. made {len(image_output)} images.")
        return image_output


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

                # --- Start the inference in the background ---
                # Use .spawn() to run remotely without blocking
                images = inference.run.remote(prompt, batch_size=1)

                print(f"submitted inference job for run {run_id}. ")

                # --- Wait for the main inference call to finish ---
                try:
                    await websocket.send_text(
                        f"inference result received for run {run_id}."
                    )
                except Exception as e:
                    print(f"Error during inference execution: {e}")
                    await websocket.send_text(f"Error during generation: {e}")
                    continue  # Skip saving if inference failed

                # --- Process and save final results ---
                run_output_path = Path(output_dir / f"run_{run_id}/")
                run_output_path.mkdir(exist_ok=True)

                # Save final images and send them via WebSocket
                for i, image_bytes in enumerate(images):
                    output_path = run_output_path / f"output_{i:02d}.png"
                    output_path.write_bytes(image_bytes)

                    # Send the image as bytes
                    await websocket.send_bytes(image_bytes)

                # Send completion message
                await websocket.send_text("done")

        except WebSocketDisconnect:
            print("Client disconnected")
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
