import io
import random
import time
from pathlib import Path
from typing import Optional

import modal

APP_NAME = "exhibition-pregen-malaya"
MODEL_NAME = "runwayml/stable-diffusion-v1-5"
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
    from diffusers import StableDiffusionImg2ImgPipeline
    from PIL import Image

CACHE_DIR = "/cache/sd-v1-5"
cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

# Constants for image-to-image
POEM_OF_MALAYA_SIZE = (960, 800)
PROMPT_2 = "painting like an epic poem of malaya"
PROMPT_2B = "crowd of people in a public space"
GUIDANCE_SCALE_2B = 8.5
STEPS = 50


@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol},
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    min_containers=0,
    max_containers=3,
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
        program_key: str,
        seed: Optional[int] = None,
        strength: float = 0.75,
        guidance_scale: Optional[float] = None,
        width: int = 960,
        height: int = 800,
        num_inference_steps: int = STEPS,
    ) -> bytes:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")
        if not self.malaya_image:
            raise RuntimeError("Malaya image not loaded.")

        # Process prompt and guidance based on program key
        if program_key == "P2":
            processed_prompt = PROMPT_2 if not prompt.strip() else prompt
            final_guidance_scale = guidance_scale or 7.5
        elif program_key == "P2B":
            if prompt.strip():
                processed_prompt = f"{prompt}, {PROMPT_2B}"
            else:
                processed_prompt = PROMPT_2B
            final_guidance_scale = guidance_scale or GUIDANCE_SCALE_2B
        else:
            processed_prompt = prompt
            final_guidance_scale = guidance_scale or 7.5

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for program {program_key}: '{processed_prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        # Run the pipeline
        images = self.pipe(
            prompt=processed_prompt,
            image=self.malaya_image,
            strength=strength,
            guidance_scale=final_guidance_scale,
            num_inference_steps=num_inference_steps,
            generator=generator,
            width=width,
            height=height,
        ).images
        
        print("inference complete!")

        # Convert final image to bytes
        image = images[0]
        with io.BytesIO() as buf:
            image.save(buf, format="PNG")
            image_bytes = buf.getvalue()

        print(f"Generated image for program {program_key}. Size: {len(image_bytes)} bytes.")
        return image_bytes


@app.function(
    timeout=650,
    min_containers=0,
    max_containers=3,
)
@modal.asgi_app()
def endpoint():
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel

    web_app = FastAPI()
    inference = Inference()

    class GenerateRequest(BaseModel):
        program_key: str
        prompt: str
        seed: Optional[int] = None
        strength: float = 0.75
        guidance_scale: Optional[float] = None
        width: int = 960
        height: int = 800
        num_inference_steps: int = STEPS

    @web_app.get("/")
    async def get():
        return {
            "status": "ok",
            "service": "exhibition-pregen-malaya",
            "timestamp": int(time.time()),
            "supported_programs": ["P2", "P2B"],
            "base_image": "Epic Poem of Malaya"
        }

    @web_app.post("/generate")
    async def generate_image(request: GenerateRequest):
        # Validate program key
        if request.program_key not in ["P2", "P2B"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported program key: {request.program_key}. Supported: P2, P2B"
            )

        try:
            # Call inference
            image_bytes = inference.run.remote(
                prompt=request.prompt,
                program_key=request.program_key,
                seed=request.seed,
                strength=request.strength,
                guidance_scale=request.guidance_scale,
                width=request.width,
                height=request.height,
                num_inference_steps=request.num_inference_steps,
            )

            # Return binary image
            return Response(
                content=image_bytes,
                media_type="image/png",
                headers={
                    "Content-Disposition": f"inline; filename=malaya_{request.program_key}_{int(time.time())}.png"
                }
            )

        except Exception as e:
            print(f"Error during inference: {e}")
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    return web_app