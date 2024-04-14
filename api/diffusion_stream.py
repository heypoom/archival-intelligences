from __future__ import annotations
import bentoml
import torch
from typing import List, Optional, AsyncGenerator
from PIL.Image import Image
import PIL.Image as PILImage
from diffusers import DPMSolverMultistepScheduler, DiffusionPipeline
from transformers import CLIPTextModel, CLIPTokenizer

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import cv2

model_id = "stabilityai/stable-diffusion-xl-base-1.0"

app = FastAPI()

tokenizer = CLIPTokenizer.from_pretrained(model_id, subfolder="tokenizer")
text_encoder = CLIPTextModel.from_pretrained(model_id, subfolder="text_encoder")

scheduler = DPMSolverMultistepScheduler.from_pretrained(model_id, subfolder="scheduler")

pipeline = DiffusionPipeline.from_pretrained(
    model_id,
    scheduler=scheduler,
    tokenizer=tokenizer,
    text_encoder=text_encoder,
    torch_dtype=torch.float16
).to(device="mps")


def latents_to_rgb(latents):
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


async def generate_image():
    def denoising_callback(pipe, step, timestep, callback_kwargs):
        latents = callback_kwargs["latents"]
        yield latents_to_rgb(latents)
        return callback_kwargs

    pipeline_result = pipeline(
        "A photo of a cat",
        num_inference_steps=10,
        guidance_scale=5.5,
        callback_on_step_end=denoising_callback,
        callback_on_step_end_tensor_inputs=['latents'],
    )


@app.get("/stream")
async def stream_image():
    async def produce():
        image = await generate_image()

        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")

    return StreamingResponse(produce(), media_type="multipart/x-mixed-replace; boundary=frame")
