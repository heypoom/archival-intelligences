import time
import torch

from diffusers import StableDiffusionImg2ImgPipeline, AutoPipelineForText2Image

start_time = time.time()

text2img = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda:0")

# Program 2 pipeline: Epic Poem of Malaya, Image to Image
img2img = StableDiffusionImg2ImgPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
).to("cuda:1")


print(f"two diffusion pipelines ready in {time.time() - start_time}s")
