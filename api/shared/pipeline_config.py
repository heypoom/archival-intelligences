"""
Centralized pipeline configuration for all operation modes (A, B, C)
Single source of truth for models, inference steps, dimensions, etc.
"""

from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass

@dataclass
class ProgramConfig:
    """Configuration for a specific program (P0, P2, P3, etc.)"""
    model_id: str
    pipeline_type: str  # "text2img", "img2img", "lora"
    inference_steps: int
    guidance_scale: float
    width: int
    height: int
    prompt_template: Optional[str] = None
    strength: Optional[float] = None  # For img2img
    lora_path: Optional[str] = None
    source_image: Optional[str] = None  # For img2img

# Program configurations - single source of truth
PROGRAM_CONFIGS: Dict[str, ProgramConfig] = {
    "P0": ProgramConfig(
        model_id="stabilityai/stable-diffusion-3.5-large-turbo",
        pipeline_type="text2img",
        inference_steps=20,
        guidance_scale=7.5,
        width=1360,
        height=768,
        prompt_template="{prompt}, photorealistic, high quality, detailed"
    ),
    
    "P2": ProgramConfig(
        model_id="stable-diffusion-v1-5/stable-diffusion-v1-5",
        pipeline_type="img2img", 
        inference_steps=15,
        guidance_scale=7.5,
        width=960,
        height=800,
        prompt_template="{prompt}, painting like epic poem of malaya",
        strength=0.8,
        source_image="./malaya.png"
    ),
    
    "P2B": ProgramConfig(
        model_id="stable-diffusion-v1-5/stable-diffusion-v1-5",
        pipeline_type="img2img",
        inference_steps=15, 
        guidance_scale=7.5,
        width=960,
        height=800,
        prompt_template="{prompt}, crowd of people in public space, painting like epic poem of malaya",
        strength=0.8,
        source_image="./malaya.png"
    ),
    
    "P3": ProgramConfig(
        model_id="stabilityai/stable-diffusion-3.5-large-turbo",
        pipeline_type="lora",
        inference_steps=20,
        guidance_scale=7.5,
        width=800,  # Will be randomized
        height=600,
        prompt_template="chua mia tee painting, {prompt}",
        lora_path="./chuamiatee.safetensors"
    ),
    
    "P3B": ProgramConfig(
        model_id="stabilityai/stable-diffusion-3.5-large-turbo", 
        pipeline_type="lora",
        inference_steps=20,
        guidance_scale=7.5,
        width=800,
        height=600,
        prompt_template="chua mia tee painting, {prompt}, photorealistic",
        lora_path="./chuamiatee.safetensors"
    ),
    
    "P4": ProgramConfig(
        model_id="stabilityai/stable-diffusion-3.5-large-turbo",
        pipeline_type="text2img",
        inference_steps=20,
        guidance_scale=7.5,
        width=1360,
        height=768,
        prompt_template="person, {prompt}, photorealistic"
    )
}

# Random sizes for P3/P3B LoRA programs
LORA_RANDOM_SIZES: List[Tuple[int, int]] = [
    (800, 600), (600, 800), (1024, 576), (576, 1024)
]

# Model cache configurations
MODEL_CACHE_CONFIG = {
    "cache_dir": "/cache",
    "torch_dtype": "bfloat16",  # Use bfloat16 for better performance
    "enable_xformers": True,
    "enable_model_cpu_offload": False,
    "low_vram_mode": False
}

# R2 storage configuration
R2_CONFIG = {
    "bucket_structure": "actions/{action_id}/sets/{set_id}/",
    "preview_format": "jpeg",
    "preview_quality": 75,
    "final_format": "png",
    "metadata_filename": "meta.json"
}

# Generation behavior configuration
GENERATION_CONFIG = {
    "default_sets_per_action": 5,
    "max_parallel_generations": 3,
    "preview_steps_enabled": True,
    "interrupt_check_enabled": True,
    "timing_collection_enabled": True
}

def get_program_config(program_id: str) -> ProgramConfig:
    """Get configuration for a specific program"""
    if program_id not in PROGRAM_CONFIGS:
        raise ValueError(f"Unknown program: {program_id}")
    return PROGRAM_CONFIGS[program_id]

def get_lora_size(seed: Optional[int] = None) -> Tuple[int, int]:
    """Get randomized size for LoRA programs (deterministic if seed provided)"""
    import random
    if seed is not None:
        random.seed(seed)
    return random.choice(LORA_RANDOM_SIZES)

def format_prompt(program_id: str, base_prompt: str, override_prompt: Optional[str] = None) -> str:
    """Format prompt according to program template"""
    if override_prompt:
        return override_prompt
        
    config = get_program_config(program_id)
    if config.prompt_template:
        return config.prompt_template.format(prompt=base_prompt)
    return base_prompt

def get_model_config(model_id: str) -> dict:
    """Get model-specific loading configuration"""
    base_config = MODEL_CACHE_CONFIG.copy()
    
    # Model-specific overrides
    if "stable-diffusion-3.5" in model_id:
        base_config["torch_dtype"] = "bfloat16"
    elif "stable-diffusion-v1-5" in model_id:
        base_config["torch_dtype"] = "float16"
    
    return base_config