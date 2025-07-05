import torch
from utils.pipeline_manager import denoise
from utils.pipelines import text2img

WIDTH, HEIGHT = 1360, 768
PROGRAM_0_STEPS = 30
PROGRAM_4_STEPS = 30


async def infer_program_0(prompt: str, conn_id=None):
    def pipeline(on_step_end):
        with torch.inference_mode():
            return text2img(
                prompt=f"{prompt}, photorealistic",
                num_inference_steps=PROGRAM_0_STEPS,
                callback_on_step_end=on_step_end,
                width=WIDTH,
                height=HEIGHT,
            )

    async for out in denoise(pipeline, final_only=True, conn_id=conn_id):
        yield out


async def infer_program_4(prompt: str, conn_id=None):
    def pipeline(on_step_end):
        p4_prompt = prompt

        if prompt in ["data researcher", "crowdworker", "big tech ceo"]:
            p4_prompt = f"{prompt}, photorealistic"

        with torch.inference_mode():
            return text2img(
                prompt=p4_prompt,
                num_inference_steps=PROGRAM_4_STEPS,
                callback_on_step_end=on_step_end,
                callback_on_step_end_tensor_inputs=["latents"],
                width=WIDTH,
                height=HEIGHT,
            )

    async for out in denoise(pipeline, conn_id=conn_id):
        yield out
