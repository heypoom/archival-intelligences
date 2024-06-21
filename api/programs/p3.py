import time

from utils.chuamiatee_size import get_chuamiatee_size
from utils.pipeline_manager import denoise

from utils.pipelines import text2img


async def infer_program_3(prompt: str, strength: float):
    width, height = get_chuamiatee_size()

    lora_start = time.time()

    text2img.load_lora_weights(
        "heypoom/chuamiatee-1", weight_name="pytorch_lora_weights.safetensors"
    )

    print(f"LoRA weights loaded in {time.time() - lora_start}s")

    def pipeline(on_step_end):
        return text2img(
            prompt=prompt,
            strength=strength,
            num_inference_steps=50,
            callback_on_step_end=on_step_end,
            callback_on_step_end_tensor_inputs=["latents"],
            width=width,
            height=height,
        )

    async for out in denoise(pipeline):
        yield out

    text2img.unload_lora_weights()
    print("LoRA unloaded")
