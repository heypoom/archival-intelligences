from __future__ import annotations

import time
import io
import os
from typing import Generator, Optional

import PIL.Image as PILImage
import starlette.websockets
from diffusers import AutoPipelineForText2Image
import torch
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import numpy as np

import threading

DEVICE = os.environ.get("TORCH_DEVICE", "cuda")
print(f"torch device is {DEVICE}")

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

from diffusers import StableDiffusionImg2ImgPipeline

print("P2 LOAD")

# program 2 pipeline: malaya
p2_pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5"
).to(DEVICE)

print("P3 LOAD")

# program 3 pipeline: a chua mia tee painting
p3_pipeline = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16
).to(DEVICE)

p3_pipeline.load_lora_weights(
    "heypoom/chuamiatee-1",
    weight_name="pytorch_lora_weights.safetensors"
)

print("P4 LOAD")

# program 4 pipeline: regular stable diffusion
p4_pipeline = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16
).to(DEVICE)

# def latents_to_rgb(latents, target_image_size=(512, 512)):
#     # Ensure latents are in the correct format
#     if not isinstance(latents, torch.Tensor):
#         latents = torch.tensor(latents)
#
#     # Normalize latents to the range [0, 1]
#     latents = (latents - latents.min()) / (latents.max() - latents.min())
#
#     # Upsample the latents to the target image size
#     upsampled_latents = torch.nn.functional.interpolate(
#         latents,
#         size=target_image_size,
#         mode='bilinear',
#         align_corners=False
#     )
#
#     # Convert latents to RGB format
#     rgb_image = (upsampled_latents[0].permute(1, 2, 0).detach().cpu().numpy()[:, :, :3] * 255).astype(np.uint8)
#
#     return PILImage.fromarray(rgb_image)


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
    rgb_tensor = torch.einsum("...lxy,lr -> ...rxy", latents, weights_tensor) + biases_tensor.unsqueeze(-1).unsqueeze(-1)
    image_array = rgb_tensor.clamp(0, 255)[0].byte().cpu().numpy()
    image_array = image_array.transpose(1, 2, 0)

    return PILImage.fromarray(image_array)

# def latents_to_rgb(latents, image_size=(512, 512)):
#     # Ensure latents are in the correct format
#     latents = np.array(latents)
#
#     # Normalize latents to the range [0, 1]
#     latents = (latents - np.min(latents)) / (np.max(latents) - np.min(latents))
#
#     # Scale latents to the desired image size
#     latents = np.array(PILImage.fromarray(latents).resize(image_size))
#
#     # Convert latents to RGB format
#     rgb_image = np.uint8(latents * 255)
#
#     return PILImage.fromarray(rgb_image)

def denoise_program_2() -> Generator[bytes]:
    signal = Signal()

    malaya = PILImage.open("./notebook/malaya.png")

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising P2, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB").resize((512, 512))
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p2_pipeline(
            prompt="a dream",
            image=malaya.resize((512, 512)).convert("RGB"),
            # TODO: depend on guidance scale input?
            strength=0.6,
            num_inference_steps=300,
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
        image = latents_to_rgb(latents).convert("RGB").resize((512, 512))
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p3_pipeline(
            "chua mia tee painting",
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


def denoise_program_4() -> Generator[bytes]:
    signal = Signal()

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising P4, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB").resize((512, 512))
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            value = buffer.getvalue()
            signal.send(value)
        return callback_kwargs

    def run_pipeline():
        result = p4_pipeline(
            # use input from prompt,
            "a dream",
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            command = await websocket.receive_text()
            command = command.strip()
            print(f"ws_command: {command}")
            if command == "P2":
                await websocket.send_text(f"ready")
                for image_bytes in denoise_program_2():
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
            elif command == "P4":
                await websocket.send_text(f"ready")
                for image_bytes in denoise_program_4():
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
