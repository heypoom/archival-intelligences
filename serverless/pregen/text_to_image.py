import io
import os
import random
import time
import uuid
from typing import Optional

import modal

APP_NAME = "exhibition-pregen-text-to-image"
MODEL_NAME = "black-forest-labs/FLUX.1-dev"
app = modal.App(APP_NAME)

SUPPORTED_PROGRAMS = ["P0", "P3", "P3B", "P4"]
CHUAMIATEE_PROGRAMS = ["P3", "P3B"]

# Default generation parameters
DEFAULT_WIDTH = 1360
DEFAULT_HEIGHT = 768
DEFAULT_GUIDANCE_SCALE = 3.5
DEFAULT_NUM_INFERENCE_STEPS = 25

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
        "peft",
        "numpy",
        "Pillow",
        "valkey[libvalkey]",
        "boto3"
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

with image.imports():
    import torch
    from diffusers.pipelines.flux.pipeline_flux import FluxPipeline
    from PIL import Image
    import boto3

CACHE_DIR = "/cache/flux-dev"
cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

# Constants for LORA
LORA_WEIGHTS = "heypoom/chuamiatee-flux-lora"
LORA_WEIGHT_NAME = "flux-lora.safetensors"

# R2 Configuration
R2_BUCKET_NAME = "poom-images"

def upload_to_r2(file_data: bytes, key: str) -> bool:
    """
    Upload bytes to Cloudflare R2 bucket using the same configuration as upload.py
    
    Args:
        file_data: Binary data to upload
        key: Object key/path in the bucket
        
    Returns:
        bool: True if upload successful, False otherwise
    """
    
    # R2 credentials from environment variables
    account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
    access_key = os.getenv('CLOUDFLARE_ACCESS_KEY_ID')
    secret_key = os.getenv('CLOUDFLARE_SECRET_ACCESS_KEY')
    
    if not all([account_id, access_key, secret_key]):
        print("Missing required environment variables:")
        print("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY")
        return False
    
    # R2 endpoint URL
    endpoint_url = f'https://{account_id}.r2.cloudflarestorage.com'
    
    # Create S3 client configured for R2
    s3_client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='auto'
    )
    
    try:
        # Upload the bytes
        s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=file_data,
            ContentType='image/png'
        )
        print(f"Successfully uploaded {len(file_data)} bytes to {R2_BUCKET_NAME}/{key}")
        return True
        
    except Exception as e:
        print(f"Upload failed: {e}")
        return False


@app.cls(
    image=image,
    gpu="H100",
    volumes={CACHE_DIR: cache_vol},
    timeout=600,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("r2-secret"),
    ],
    min_containers=1,
    max_containers=3,
)
class Inference:
    lora_loaded: bool = modal.parameter(default=False, init=False)

    @modal.enter()
    def initialize(self):
        print("initializing pipeline...")

        self.pipe = FluxPipeline.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.bfloat16,
            token=os.environ["HF_TOKEN"]
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
            self.pipe.load_lora_weights(LORA_WEIGHTS, weight_name=LORA_WEIGHT_NAME, token=os.environ["HF_TOKEN"])
            self.lora_loaded = True
        elif not use_lora and self.lora_loaded:
            print("Unloading LORA weights...")
            self.pipe.unload_lora_weights()
            self.lora_loaded = False

    @modal.method()
    def run(
        self,
        prompt: str,
        program_key: str,
        seed: Optional[int] = None,
        width: int = DEFAULT_WIDTH,
        height: int = DEFAULT_HEIGHT,
        guidance_scale: float = DEFAULT_GUIDANCE_SCALE,
        num_inference_steps: int = DEFAULT_NUM_INFERENCE_STEPS,
    ) -> bytes:
        if not self.pipe:
            raise RuntimeError("Pipeline not initialized or moved to GPU.")
        if self.pipe.device.type != "cuda":
            raise RuntimeError("Pipeline not on CUDA device.")

        # Determine if we should use LoRA based on program key
        use_lora = program_key in CHUAMIATEE_PROGRAMS
        
        # Ensure LORA is in the correct state
        self._ensure_lora_state(use_lora)

        # Modify prompt based on program key
        if program_key == "P3B":
            modified_prompt = f"{prompt}, photorealistic"
        elif program_key == "P4":
            if prompt.strip() in ["data researcher", "crowdworker", "big tech ceo"]:
                modified_prompt = f"{prompt}, photorealistic"
            else:
                modified_prompt = prompt
        else:
            modified_prompt = prompt

        seed = seed if seed is not None else random.randint(0, 2**32 - 1)
        print(f"running inference for program {program_key}: '{modified_prompt}' with seed {seed}")
        generator = torch.Generator("cuda").manual_seed(seed)

        start_time = time.time()

        # Run the pipeline
        images = self.pipe(
            prompt=modified_prompt,
            num_images_per_prompt=1,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
            width=width,
            height=height,
        ).images
        
        print("inference complete!")
        print(f"Time taken for inference: {time.time() - start_time:.2f} seconds")

        # Convert final image to bytes
        image = images[0]
        with io.BytesIO() as buf:
            image.save(buf, format="PNG")
            image_bytes = buf.getvalue()

        print(f"Generated image for program {program_key}. Size: {len(image_bytes)} bytes.")

        # Generate random ID and upload to R2
        random_id = str(uuid.uuid4())
        r2_key = f"gen-test/{random_id}.png"
        
        upload_success = upload_to_r2(image_bytes, r2_key)
        if upload_success:
            print(f"Image uploaded to R2: {r2_key}")
        else:
            print(f"Failed to upload image to R2: {r2_key}")

        return image_bytes


@app.function(
    timeout=650,
    min_containers=1,
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
        width: int = DEFAULT_WIDTH
        height: int = DEFAULT_HEIGHT
        guidance_scale: float = DEFAULT_GUIDANCE_SCALE
        num_inference_steps: int = DEFAULT_NUM_INFERENCE_STEPS

    @web_app.get("/")
    async def get():
        return {
            "status": "ok",
            "service": "exhibition-pregen-text-to-image",
            "timestamp": int(time.time()),
            "supported_programs": SUPPORTED_PROGRAMS,
        }

    @web_app.post("/generate")
    async def generate_image(request: GenerateRequest):
        # Validate program key
        if request.program_key not in SUPPORTED_PROGRAMS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported program key: {request.program_key}. Supported: P0, P3, P3B, P4"
            )

        try:
            # Call inference
            image_bytes = inference.run.remote(
                prompt=request.prompt,
                program_key=request.program_key,
                seed=request.seed,
                width=request.width,
                height=request.height,
                guidance_scale=request.guidance_scale,
                num_inference_steps=request.num_inference_steps,
            )

            # Return binary image
            return Response(
                content=image_bytes,
                media_type="image/png",
                headers={
                    "Content-Disposition": f"inline; filename=generated_{request.program_key}_{int(time.time())}.png"
                }
            )

        except Exception as e:
            print(f"Error during inference: {e}")
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    return web_app