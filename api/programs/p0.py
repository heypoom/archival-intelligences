# Program 0 and 4 pipeline: regular stable diffusion
import torch

from diffusers import AutoPipelineForText2Image

from utils.pipeline_manager import denoise, return_image

text2img = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda:0")

WIDTH, HEIGHT = 1360, 768


async def infer_program_0(prompt: str):
    def get_image():
        return text2img(
            prompt=prompt,
            num_inference_steps=30,
            width=WIDTH,
            height=HEIGHT,
        )

    async for img_bytes in return_image(get_image):
        yield img_bytes
    return


async def infer_program_4(prompt: str):
    def pipeline(on_step_end):
        return text2img(
            prompt=prompt,
            num_inference_steps=50,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=WIDTH,
            height=HEIGHT,
        )

    async for img_bytes in denoise(pipeline):
        yield img_bytes
    return
