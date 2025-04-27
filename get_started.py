import io
import random
from pathlib import Path

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

CACHE_DIR = "/cache"
cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol},
    timeout=600,
)
class Inference:
    @modal.enter()
    def initialize(self):
        self.pipe = diffusers.StableDiffusion3Pipeline.from_pretrained(
            "adamo1139/stable-diffusion-3.5-large-turbo-ungated",
            revision="9ad870ac0b0e5e48ced156bb02f85d324b7275d2",
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,
        )

    @modal.enter()
    def move_to_gpu(self):
        self.pipe.to("cuda")

    @modal.method()
    def run(self, prompt: str, batch_size: int = 4, seed: int = None) -> list[bytes]:
        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print("seeding RNG with", seed)
        torch.manual_seed(seed)

        images = self.pipe(
            prompt,
            num_images_per_prompt=batch_size,
            num_inference_steps=4,
            guidance_scale=0.0,
            max_sequence_length=512,
        ).images

        image_output = []
        for image in images:
            with io.BytesIO() as buf:
                image.save(buf, format="PNG")
                image_output.append(buf.getvalue())
        torch.cuda.empty_cache()
        return image_output

@app.function()
@modal.asgi_app()
def endpoint():
    from fastapi import FastAPI, WebSocket

    app = FastAPI()


    output_dir = Path("/tmp/stable-diffusion")
    output_dir.mkdir(exist_ok=True)
    inference = Inference()

    @app.websocket("/ws")
    async def websocket_handler(websocket: WebSocket) -> None:
        await websocket.accept()
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"message text was: {data}")

            prompt = data.strip()
            await websocket.send_text(f"running inference for prompt: {data}")

            images = inference.run.remote(prompt, batch_size=1)

            for i, image_bytes in enumerate(images):
                output_path = output_dir / f"output_{i:02d}.png"
                output_path.write_bytes(image_bytes)
                await websocket.send_text(f"saved {output_path}")

    return app

