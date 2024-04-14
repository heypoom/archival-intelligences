from __future__ import annotations
import bentoml
import torch
from typing import List, Optional, AsyncGenerator
from PIL.Image import Image
from diffusers import DPMSolverMultistepScheduler, DiffusionPipeline
from transformers import CLIPTextModel, CLIPTokenizer

model_id = "stabilityai/stable-diffusion-xl-base-1.0"


@bentoml.service(
    resources={"gpu": 1},
    traffic={"timeout": 300},
    workers=1
)
class DiffusionXL:
    def __init__(self) -> None:
        tokenizer = CLIPTokenizer.from_pretrained(model_id, subfolder="tokenizer")
        text_encoder = CLIPTextModel.from_pretrained(model_id, subfolder="text_encoder")

        scheduler = DPMSolverMultistepScheduler.from_pretrained(model_id, subfolder="scheduler")

        self.pipeline = DiffusionPipeline.from_pretrained(
            model_id,
            scheduler=scheduler,
            tokenizer=tokenizer,
            text_encoder=text_encoder,
            torch_dtype=torch.float16
        ).to(device="mps")

    @bentoml.api
    def generate(self, prompt: str, steps: int) -> List[Image]:
        pipeline_result = self.pipeline(
            prompt,
            num_inference_steps=steps,
            guidance_scale=5.5
        )

        return pipeline_result.images
