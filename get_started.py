import io
import os
import random
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

import modal

app = modal.App("archival-intelligences-test")

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

CACHE_DIR = "/cache"
GENERATED_DIR = "/generated"
cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)
generated_vol = modal.Volume.from_name("generated", create_if_missing=True)

# "adamo1139/stable-diffusion-3.5-large-turbo-ungated"
# revision="9ad870ac0b0e5e48ced156bb02f85d324b7275d2"


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
        self.pipe = StableDiffusion3Pipeline.from_pretrained(
            "stabilityai/stable-diffusion-3.5-large-turbo",
            use_auth_token=os.environ["HF_TOKEN"],
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,
        )

    @modal.enter()
    def move_to_gpu(self):
        self.pipe.to("cuda")

    @modal.method()
    def run(
        self, prompt: str, batch_size: int = 4, seed: int = None
    ) -> tuple[list[bytes], list[bytes]]:
        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print("seeding RNG with", seed)
        torch.manual_seed(seed)

        # Store intermediate latent images and preview images
        intermediate_latents = []
        preview_images = []

        # Callback function to save intermediate steps
        def step_callback(pipe, step_index, timestep, callback_kwargs):
            # Get the current latents
            latents = callback_kwargs["latents"]

            # Store a copy of the latents
            intermediate_latents.append(latents.clone())

            # Decode the latents to an image
            with torch.no_grad():
                # Since SD3 uses a different architecture, we need to decode differently
                if hasattr(pipe, "vae"):
                    # Scale the latents by the scaling factor
                    scaled_latents = latents / pipe.vae.config.scaling_factor
                    # Decode using VAE
                    image = pipe.vae.decode(scaled_latents).sample
                    # Convert from tensor to PIL image
                    image = (image / 2 + 0.5).clamp(0, 1)
                    image = image.cpu()

                    # Properly handle the batch dimension
                    if len(image.shape) == 4:  # [batch, channels, height, width]
                        image = image[0]  # Take first image from batch

                    # Permute to [height, width, channels] and convert to numpy
                    image = image.permute(1, 2, 0).float().numpy()

                    # Handle potential 3D shapes
                    if len(image.shape) == 3 and image.shape[2] == 3:
                        # If it's already RGB
                        image = (image * 255).round().astype("uint8")
                    else:
                        # If it's not RGB, visualize as grayscale
                        image = image.mean(axis=-1) if len(image.shape) > 2 else image
                        image = (image * 255).round().astype("uint8")
                        # Convert to RGB for saving
                        image = np.stack([image] * 3, axis=-1)

                    preview_image = Image.fromarray(image)
                else:
                    # Fallback: visualize latents directly as a heatmap
                    latent_np = latents[0].cpu().numpy()
                    # Normalize for visualization
                    latent_vis = (latent_np - latent_np.min()) / (
                        latent_np.max() - latent_np.min()
                    )
                    # Convert to RGB
                    latent_vis = (latent_vis * 255).astype("uint8")
                    # Take the first channel or average across channels
                    if len(latent_vis.shape) > 2:
                        latent_vis = latent_vis.mean(axis=0)
                    preview_image = Image.fromarray(latent_vis, mode="L").convert("RGB")

                # Save preview image to bytes
                with io.BytesIO() as buf:
                    preview_image.save(buf, format="PNG")
                    preview_images.append(buf.getvalue())

            return callback_kwargs

        # Run the pipeline with callback
        images = self.pipe(
            prompt,
            num_images_per_prompt=batch_size,
            num_inference_steps=10,
            guidance_scale=0.0,
            max_sequence_length=512,
            callback_on_step_end=step_callback,
            width=1360,
            height=768,
        ).images

        # Convert final images to bytes
        image_output = []
        for image in images:
            with io.BytesIO() as buf:
                image.save(buf, format="PNG")
                image_output.append(buf.getvalue())

        torch.cuda.empty_cache()

        return image_output, preview_images


@app.function(
    volumes={GENERATED_DIR: generated_vol},
)
@modal.asgi_app()
def endpoint():
    from fastapi import FastAPI, WebSocket

    app = FastAPI()

    output_dir = Path(GENERATED_DIR)
    output_dir.mkdir(exist_ok=True)
    inference = Inference()

    @app.websocket("/ws")
    async def websocket_handler(websocket: WebSocket) -> None:
        await websocket.accept()
        while True:
            data = await websocket.receive_text()
            run_id = int(time.time())
            await websocket.send_text(f"message text was: {data}")

            prompt = data.strip()
            await websocket.send_text(f"running inference for prompt: {data}")

            # Get both final images and preview images
            images, preview_images = inference.run.remote(prompt, batch_size=1)

            run_output_path = Path(output_dir / f"run_{run_id}/")
            run_output_path.mkdir(exist_ok=True)

            # Save preview images
            for i, preview_bytes in enumerate(preview_images):
                preview_path = run_output_path / f"preview_{i:02d}.png"
                preview_path.write_bytes(preview_bytes)
                await websocket.send_text(f"saved {preview_path}")

            # Save final images
            for i, image_bytes in enumerate(images):
                output_path = run_output_path / f"output_{i:02d}.png"
                output_path.write_bytes(image_bytes)
                await websocket.send_text(f"saved {output_path}")

    return app
