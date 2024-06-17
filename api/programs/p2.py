import PIL.Image as PILImage
from diffusers import StableDiffusionImg2ImgPipeline

from api.utils.chuamiatee_size import get_chuamiatee_size
from api.utils.pipeline_manager import run_pipeline

STEPS = 50
PROMPT_2 = "people gathering"
PROMPT_2B = "crowd of people in a public space"
GUIDANCE_SCALE_2B = 8.5

# Program 2 pipeline: Epic Poem of Malaya, Image to Image
img2img = StableDiffusionImg2ImgPipeline.from_pretrained(
  "runwayml/stable-diffusion-v1-5",
).to("cuda:1")

MALAYA = PILImage.open("./malaya.png").resize((768, 768)).convert("RGB")

async def infer_program_2(strength: float):
  width, height = get_chuamiatee_size()

  def pipeline(on_step_end):
    return img2img(
      image=MALAYA,
      prompt=PROMPT_2,
      strength=strength,
      num_inference_steps=STEPS,
      callback_on_step_end=on_step_end,
      callback_on_step_end_tensor_inputs=['latents'],
      width=width,
      height=height,
    )
  
  async for img_bytes in run_pipeline(pipeline):
    yield img_bytes

async def infer_program_2_b(strength: float):
  width, height = get_chuamiatee_size()

  def pipeline(on_step_end):
    return img2img(
      prompt=PROMPT_2B,
      image=MALAYA,
      strength=strength,
      guidance_scale=GUIDANCE_SCALE_2B,
      num_inference_steps=STEPS,
      callback_on_step_end=on_step_end,
      callback_on_step_end_tensor_inputs=['latents'],
      width=width,
      height=height
    )
  
  async for img_bytes in run_pipeline(pipeline):
    yield img_bytes