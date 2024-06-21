import PIL.Image as PILImage
from diffusers import StableDiffusionImg2ImgPipeline

from utils.chuamiatee_size import get_chuamiatee_size
from utils.pipeline_manager import denoise

STEPS = 50
PROMPT_2 = "painting like an epic poem of malaya"
PROMPT_2B = "crowd of people in a public space"
GUIDANCE_SCALE_2B = 8.5

# Program 2 pipeline: Epic Poem of Malaya, Image to Image
img2img = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
).to("cuda:1")

# 1200x1000 = 960x800
POEM_OF_MALAYA_SIZE = (960, 800)
MALAYA = PILImage.open("./malaya.png").resize(POEM_OF_MALAYA_SIZE).convert("RGB")


async def infer_program_2(strength: float):
    width, height = POEM_OF_MALAYA_SIZE

    def pipeline(on_step_end):
        return img2img(
            image=MALAYA,
            prompt=PROMPT_2,
            strength=strength,
            num_inference_steps=STEPS,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=width,
            height=height,
        )

    async for out in denoise(pipeline):
        yield out


async def infer_program_2_b(strength: float):
    width, height = POEM_OF_MALAYA_SIZE

    def pipeline(on_step_end):
        return img2img(
            prompt=PROMPT_2B,
            image=MALAYA,
            strength=strength,
            guidance_scale=GUIDANCE_SCALE_2B,
            num_inference_steps=STEPS,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=width,
            height=height,
        )

    async for out in denoise(pipeline):
        yield out
