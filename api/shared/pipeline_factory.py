"""
Pipeline factory for creating and managing diffusion pipelines
Shared across all operation modes with consistent configuration
"""

import torch
from typing import Dict, Optional, Any
from diffusers import (
    StableDiffusion3Pipeline, 
    StableDiffusionImg2ImgPipeline,
    AutoPipelineForText2Image
)
import PIL.Image

from .pipeline_config import (
    get_program_config, 
    get_model_config, 
    ProgramConfig
)

class PipelineFactory:
    """Factory for creating and managing diffusion pipelines"""
    
    def __init__(self, cache_dir: str = "/cache"):
        self.cache_dir = cache_dir
        self._pipeline_cache: Dict[str, Any] = {}
        self._lora_state: Dict[str, bool] = {}  # Track LoRA loading state
        
    def get_pipeline(self, program_id: str, force_reload: bool = False):
        """Get or create pipeline for a specific program"""
        config = get_program_config(program_id)
        cache_key = f"{program_id}_{config.model_id}"
        
        if not force_reload and cache_key in self._pipeline_cache:
            pipeline = self._pipeline_cache[cache_key]
            self._configure_lora(pipeline, config, program_id)
            return pipeline
            
        # Create new pipeline
        pipeline = self._create_pipeline(config)
        self._pipeline_cache[cache_key] = pipeline
        self._configure_lora(pipeline, config, program_id)
        
        return pipeline
    
    def _create_pipeline(self, config: ProgramConfig):
        """Create a new pipeline based on configuration"""
        model_config = get_model_config(config.model_id)
        
        # Convert torch_dtype string to actual type
        if model_config["torch_dtype"] == "bfloat16":
            torch_dtype = torch.bfloat16
        elif model_config["torch_dtype"] == "float16":
            torch_dtype = torch.float16
        else:
            torch_dtype = torch.float32
            
        common_args = {
            "cache_dir": self.cache_dir,
            "torch_dtype": torch_dtype,
        }
        
        # Create appropriate pipeline type
        if config.pipeline_type in ["text2img", "lora"]:
            if "stable-diffusion-3.5" in config.model_id:
                pipeline = StableDiffusion3Pipeline.from_pretrained(
                    config.model_id,
                    **common_args
                )
            else:
                pipeline = AutoPipelineForText2Image.from_pretrained(
                    config.model_id,
                    **common_args
                )
        elif config.pipeline_type == "img2img":
            pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
                config.model_id,
                **common_args
            )
        else:
            raise ValueError(f"Unknown pipeline type: {config.pipeline_type}")
            
        # Move to GPU
        pipeline = pipeline.to("cuda")
        
        # Enable optimizations
        if model_config.get("enable_xformers", True):
            try:
                pipeline.enable_xformers_memory_efficient_attention()
            except Exception as e:
                print(f"Warning: Could not enable xformers: {e}")
                
        if model_config.get("enable_model_cpu_offload", False):
            pipeline.enable_model_cpu_offload()
            
        return pipeline
    
    def _configure_lora(self, pipeline, config: ProgramConfig, program_id: str):
        """Configure LoRA for the pipeline if needed"""
        if config.pipeline_type != "lora" or not config.lora_path:
            return
            
        lora_key = f"{program_id}_{config.lora_path}"
        
        # Check if LoRA is already loaded
        if self._lora_state.get(lora_key, False):
            return
            
        try:
            # Unload any existing LoRA
            if hasattr(pipeline, 'unload_lora_weights'):
                pipeline.unload_lora_weights()
                
            # Load new LoRA
            pipeline.load_lora_weights(config.lora_path)
            pipeline.fuse_lora()
            
            # Update state tracking
            for key in list(self._lora_state.keys()):
                self._lora_state[key] = False
            self._lora_state[lora_key] = True
            
            print(f"Loaded LoRA: {config.lora_path} for {program_id}")
            
        except Exception as e:
            print(f"Warning: Could not load LoRA {config.lora_path}: {e}")
    
    def get_source_image(self, config: ProgramConfig) -> Optional[PIL.Image.Image]:
        """Load source image for img2img pipelines"""
        if config.pipeline_type != "img2img" or not config.source_image:
            return None
            
        try:
            return PIL.Image.open(config.source_image).convert("RGB")
        except Exception as e:
            print(f"Warning: Could not load source image {config.source_image}: {e}")
            return None
    
    def clear_cache(self):
        """Clear pipeline cache to free memory"""
        for pipeline in self._pipeline_cache.values():
            if hasattr(pipeline, 'to'):
                pipeline.to('cpu')
        self._pipeline_cache.clear()
        self._lora_state.clear()
        
        # Force garbage collection
        import gc
        gc.collect()
        torch.cuda.empty_cache()
    
    def get_memory_stats(self) -> dict:
        """Get current memory usage statistics"""
        if torch.cuda.is_available():
            return {
                "allocated": torch.cuda.memory_allocated(),
                "reserved": torch.cuda.memory_reserved(),
                "max_allocated": torch.cuda.max_memory_allocated(),
                "cached_pipelines": len(self._pipeline_cache)
            }
        return {"cached_pipelines": len(self._pipeline_cache)}

# Global factory instance for shared use
_global_factory: Optional[PipelineFactory] = None

def get_pipeline_factory(cache_dir: str = "/cache") -> PipelineFactory:
    """Get global pipeline factory instance"""
    global _global_factory
    if _global_factory is None:
        _global_factory = PipelineFactory(cache_dir)
    return _global_factory

def create_pipeline_for_program(program_id: str, cache_dir: str = "/cache"):
    """Convenience function to create pipeline for a program"""
    factory = get_pipeline_factory(cache_dir)
    return factory.get_pipeline(program_id)