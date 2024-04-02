from diffusers import StableDiffusionXLPipeline
import torch

pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.bfloat16)
pipe = pipe.to("mps")

# Recommended if your computer has less than 64 GB of RAM
pipe.enable_attention_slicing()

pipe.unet.set_default_attn_processor()
pipe.vae.set_default_attn_processor()


def stable_diffusion_image(prompt: str):
    return pipe(prompt, num_inference_steps=5, num_images_per_prompt=1).images[0]
