import torch

from diffusers import AutoPipelineForText2Image

from utils.chuamiatee_size import get_chuamiatee_size
from utils.pipeline_manager import denoise

# Program 3 pipeline: chua mia tee painting
chuamiatee = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda:1")

chuamiatee.load_lora_weights(
    "heypoom/chuamiatee-1", weight_name="pytorch_lora_weights.safetensors"
)


async def infer_program_3(prompt: str, strength: float):
    width, height = get_chuamiatee_size()

    def pipeline(on_step_end):
        return chuamiatee(
            prompt=prompt,
            strength=strength,
            num_inference_steps=40,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=width,
            height=height,
        )

    async for out in denoise(pipeline):
        yield out
