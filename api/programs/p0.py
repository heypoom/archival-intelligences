# Program 0 and 4 pipeline: regular stable diffusion
import torch

from diffusers import AutoPipelineForText2Image

from utils.pipeline_manager import denoise

text2img = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda:0")

WIDTH, HEIGHT = 1360, 768
PROGRAM_0_STEPS = 30
PROGRAM_4_STEPS = 30


async def infer_program_0(prompt: str):
    def pipeline(on_step_end):
        return text2img(
            prompt=f"{prompt}, photorealistic",
            num_inference_steps=PROGRAM_0_STEPS,
            callback_on_step_end=on_step_end,
            width=WIDTH,
            height=HEIGHT,
        )

    async for out in denoise(pipeline, final_only=True):
        yield out


async def infer_program_4(prompt: str):
    def pipeline(on_step_end):
        p4_prompt = prompt

        if prompt in ["data researcher", "crowdworker", "big tech ceo"]:
            p4_prompt = f"{prompt}, photorealistic"

        return text2img(
            prompt=p4_prompt,
            num_inference_steps=PROGRAM_4_STEPS,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=WIDTH,
            height=HEIGHT,
        )

    async for out in denoise(pipeline):
        yield out
