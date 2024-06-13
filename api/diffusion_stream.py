from __future__ import annotations

import time
import io
import os
import sys
from typing import Generator, Optional

import PIL.Image as PILImage
import starlette.websockets
from accelerate import PartialState
from diffusers import AutoPipelineForText2Image
import torch
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import threading

CUDA_0 = "cuda:0"
CUDA_1 = "cuda:1"
# distributed_state = PartialState()

if not torch.cuda.is_available():
    print("PyTorch CUDA is not available.")
    sys.exit(1)

print("CUDA is available. Starting up.")

class Signal:
    def __init__(self):
        self.event = threading.Event()
        self.data = None

    def send(self, data: Optional[bytes]):
        self.data = data
        self.event.set()

    def wait(self):
        self.event.wait()
        self.event.clear()
        return self.data

    def block(self) -> Generator[bytes]:
        while True:
            data = self.wait()
            if data is None:
                break
            yield data
        yield None


app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("LOADING PIPELINES")

from diffusers import StableDiffusionImg2ImgPipeline

# program 2 pipeline: malaya
p2_pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    # device_map="balanced"
).to(CUDA_0)

print("P2 LOADED")

# program 3 pipeline: a "chua mia tee" painting
p3_pipeline = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    # device_map="balanced"
).to(CUDA_0)

p3_pipeline.load_lora_weights(
    "heypoom/chuamiatee-1",
    weight_name="pytorch_lora_weights.safetensors"
)

print("P3 LOADED")

# program 0 and 4 pipeline: regular stable diffusion
p0_pipeline = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    # device_map="balanced"
).to(CUDA_1)

print("P4 LOADED - READY")


# https://huggingface.co/docs/diffusers/en/using-diffusers/callback#display-image-after-each-generation-step
# https://huggingface.co/blog/TimothyAlexisVass/explaining-the-sdxl-latent-space
def latents_to_rgb(latents):
    print(f'latents={latents.shape}, dtype={latents.dtype}, device={latents.device}')

    weights = (
        (60, -60, 25, -70),
        (60, -5, 15, -50),
        (60, 10, -5, -35)
    )

    weights_tensor = torch.t(torch.tensor(weights, dtype=latents.dtype).to(latents.device))
    biases_tensor = torch.tensor((150, 140, 130), dtype=latents.dtype).to(latents.device)
    rgb_tensor = torch.einsum("...lxy,lr -> ...rxy", latents, weights_tensor) + biases_tensor.unsqueeze(-1).unsqueeze(
        -1)
    image_array = rgb_tensor.clamp(0, 255)[0].byte().cpu().numpy()
    image_array = image_array.transpose(1, 2, 0)

    return PILImage.fromarray(image_array)

def denoise_program_2(strength: float) -> Generator[bytes]:
    signal = Signal()

    malaya = PILImage.open("./notebook/malaya.png")

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising P2, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB")
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p2_pipeline(
            prompt="people gathering",
            image=malaya.resize((768, 768)).convert("RGB"),
            # TODO: depend on guidance scale input?
            strength=strength,
            num_inference_steps=400,
            guidance_scale=5.5,
            callback_on_step_end=denoising_callback,
            callback_on_step_end_tensor_inputs=['latents'],
        )
        image = result.images[0]
        print(f'final image, size={image.size}')
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            signal.send(buffer.getvalue())
        time.sleep(10)
        signal.send(None)

    thread = threading.Thread(target=run_pipeline)
    thread.start()

    return signal.block()


def denoise_program_3() -> Generator[bytes]:
    signal = Signal()

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising P3, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB")
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p3_pipeline(
            "tree",
            num_inference_steps=50,
            guidance_scale=5.5,
            callback_on_step_end=denoising_callback,
            callback_on_step_end_tensor_inputs=['latents'],
        )
        image = result.images[0]
        print(f'final image, size={image.size}')
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            signal.send(buffer.getvalue())
        time.sleep(10)
        signal.send(None)

    thread = threading.Thread(target=run_pipeline)
    thread.start()

    return signal.block()


def denoise_program_4(prompt: str) -> Generator[bytes]:
    signal = Signal()

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising P4, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB")
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p0_pipeline(
            # use input from prompt,
            prompt=prompt,
            num_inference_steps=50,
            guidance_scale=5.5,
            callback_on_step_end=denoising_callback,
            callback_on_step_end_tensor_inputs=['latents'],

            # 16:9 and divisible by 8.
            width=1360,
            height=768,
        )
        image = result.images[0]
        print(f'final image, size={image.size}')
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            signal.send(buffer.getvalue())
        time.sleep(10)
        signal.send(None)

    thread = threading.Thread(target=run_pipeline)
    thread.start()

    return signal.block()


def infer_program_zero(prompt: str) -> Generator[bytes]:
    signal = Signal()

    def run_pipeline():
        result = p0_pipeline(
            prompt=prompt,
            num_inference_steps=30,
            guidance_scale=5.5,
            width=800,
            height=800
        )
        signal.send(b'SENDING')
        image = result.images[0]
        print(f'final image, size={image.size}')
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            print(f'final image, size={image.size}, bv={len(value)}')
            signal.send(value)
        time.sleep(10)
        signal.send(None)

    thread = threading.Thread(target=run_pipeline)
    thread.start()

    return signal.block()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            command = await websocket.receive_text()
            command = command.strip()
            print(f"ws_command: {command}")
            if command.startswith("P0:"):
                prompt = command.replace("P0:", "").strip()
                await websocket.send_text(f"ready")
                for image_bytes in infer_program_zero(prompt):
                    if image_bytes == b'SENDING':
                        print("- SENDING -")
                        await websocket.send_text(f"sending")
                    elif image_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    else:
                        print(f"sending image of len {len(image_bytes)}")
                        await websocket.send_bytes(image_bytes)
            elif command.startswith("P2:"):
                strength = float(command.replace("P2:", "").strip())
                await websocket.send_text(f"ready")
                for image_bytes in denoise_program_2(strength):
                    if image_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(image_bytes)}")
                    await websocket.send_bytes(image_bytes)
            elif command == "P3":
                await websocket.send_text(f"ready")
                for image_bytes in denoise_program_3():
                    if image_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(image_bytes)}")
                    await websocket.send_bytes(image_bytes)
            elif command.startswith("P4:"):
                prompt = command.replace("P4:", "").strip()
                await websocket.send_text(f"ready")
                for image_bytes in denoise_program_4(prompt):
                    if image_bytes is None:
                        print("- DONE -")
                        await websocket.send_text(f"done")
                        break
                    print(f"sending image of len {len(image_bytes)}")
                    await websocket.send_bytes(image_bytes)
            else:
                await websocket.send_text(f"unknown command: {command}")
        except starlette.websockets.WebSocketDisconnect:
            print("client disconnected.")
            break
