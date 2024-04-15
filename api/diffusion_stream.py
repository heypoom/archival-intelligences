from __future__ import annotations

import io
from typing import Generator, Optional

import PIL.Image as PILImage
from diffusers import AutoPipelineForText2Image
import torch
from fastapi import FastAPI, WebSocket
from fastapi.responses import StreamingResponse
import numpy as np

import threading


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
        raise StopIteration


app = FastAPI()

# program 3 pipeline
p3_pipeline = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16
).to("mps")

p3_pipeline.load_lora_weights(
    "heypoom/chuamiatee-1",
    weight_name="pytorch_lora_weights.safetensors"
)


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


def denoise_program_3() -> Generator[bytes]:
    signal = Signal()

    def denoising_callback(pipe, step, timestep, callback_kwargs):
        print(f'denoising, step={step}, ts={timestep}')
        latents = callback_kwargs["latents"]
        image = latents_to_rgb(latents).convert("RGB").resize((512, 512))
        print(f'denoised, size={image.size}')
        with io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            signal.send(buffer.getvalue())
        return callback_kwargs

    def run_pipeline():
        p3_pipeline(
            "chua mia tee painting, tree",
            num_inference_steps=50,
            guidance_scale=5.5,
            callback_on_step_end=denoising_callback,
            callback_on_step_end_tensor_inputs=['latents'],
        )
        signal.send(None)

    thread = threading.Thread(target=run_pipeline)
    thread.start()

    try:
        yield from signal.block()
    except StopIteration:
        pass


async def produce_gen():
    try:
        for image_bytes in denoise_program_3():
            print(f"yield: {len(image_bytes)}")
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + image_bytes + b"\r\n")
    except StopIteration:
        raise StopAsyncIteration


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        command = await websocket.receive_text()
        command = command.strip()
        print(f"ws_command: {command}")
        if command == "P3":
            await websocket.send_text(f"ready")
            try:
                for image_bytes in denoise_program_3():
                    await websocket.send_bytes(image_bytes)
            except StopIteration:
                await websocket.send_text(f"done")
                continue
        else:
            await websocket.send_text(f"unknown command: {command}")
