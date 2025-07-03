"""
Core pipeline operations shared across all modes
Handles generation logic with pluggable callbacks for mode-specific behavior
"""

import time
import io
from typing import Optional, Callable, Dict, Any, Generator, Tuple
import PIL.Image
import torch

from .pipeline_config import (
    get_program_config, 
    format_prompt, 
    get_lora_size,
    GENERATION_CONFIG
)
from .pipeline_factory import get_pipeline_factory

class GenerationContext:
    """Context object passed to callbacks during generation"""
    def __init__(self, program_id: str, action_id: str, set_id: int = 0):
        self.program_id = program_id
        self.action_id = action_id
        self.set_id = set_id
        self.start_time = time.time()
        self.step_durations: Dict[int, float] = {}
        self.current_step = 0
        self.step_start_time = None
        self.should_interrupt = False
        self.metadata: Dict[str, Any] = {}

class GenerationCallbacks:
    """Callback interface for mode-specific handling"""
    
    def on_generation_start(self, context: GenerationContext) -> None:
        """Called when generation starts"""
        pass
    
    def on_step_start(self, context: GenerationContext, step: int, timestep: int) -> None:
        """Called at the start of each step"""
        pass
    
    def on_step_end(self, context: GenerationContext, step: int, timestep: int, 
                   latents: Optional[torch.Tensor] = None) -> None:
        """Called at the end of each step"""
        pass
    
    def on_preview_image(self, context: GenerationContext, step: int, 
                        image: PIL.Image.Image) -> None:
        """Called when a preview image is generated"""
        pass
    
    def on_final_image(self, context: GenerationContext, image: PIL.Image.Image) -> None:
        """Called when final image is generated"""
        pass
    
    def on_generation_complete(self, context: GenerationContext) -> None:
        """Called when generation is complete"""
        pass
    
    def on_error(self, context: GenerationContext, error: Exception) -> None:
        """Called when an error occurs"""
        pass
    
    def should_interrupt(self, context: GenerationContext) -> bool:
        """Called to check if generation should be interrupted"""
        return context.should_interrupt

class PipelineOperations:
    """Core pipeline operations with callback support"""
    
    def __init__(self, cache_dir: str = "/cache"):
        self.factory = get_pipeline_factory(cache_dir)
    
    def generate_image(self, 
                      program_id: str,
                      prompt: str,
                      action_id: str = "default",
                      set_id: int = 0,
                      override_prompt: Optional[str] = None,
                      callbacks: Optional[GenerationCallbacks] = None,
                      **kwargs) -> GenerationContext:
        """
        Generate image for a specific program with callback support
        
        Args:
            program_id: Program identifier (P0, P2, P3, etc.)
            prompt: Base prompt for generation
            action_id: Unique identifier for this generation action
            set_id: Set identifier for batch generation
            override_prompt: Override the formatted prompt
            callbacks: Callback handler for mode-specific behavior
            **kwargs: Additional generation parameters
        """
        config = get_program_config(program_id)
        context = GenerationContext(program_id, action_id, set_id)
        
        if callbacks is None:
            callbacks = GenerationCallbacks()
        
        try:
            callbacks.on_generation_start(context)
            
            # Get pipeline
            pipeline = self.factory.get_pipeline(program_id)
            
            # Prepare parameters
            generation_params = self._prepare_generation_params(
                config, prompt, override_prompt, context, **kwargs
            )
            
            # Setup progress callback
            progress_callback = self._create_progress_callback(context, callbacks)
            generation_params['callback_on_step_end'] = progress_callback
            generation_params['callback_on_step_end_tensor_inputs'] = ['latents']
            
            # Generate based on pipeline type
            if config.pipeline_type == "img2img":
                result = self._generate_img2img(pipeline, config, generation_params)
            else:
                result = self._generate_text2img(pipeline, generation_params)
            
            # Handle final image
            final_image = result.images[0]
            callbacks.on_final_image(context, final_image)
            
            context.metadata['total_duration'] = time.time() - context.start_time
            context.metadata['generation_config'] = {
                'program': program_id,
                'prompt': generation_params.get('prompt'),
                'num_inference_steps': generation_params.get('num_inference_steps'),
                'guidance_scale': generation_params.get('guidance_scale'),
                'width': generation_params.get('width'),
                'height': generation_params.get('height')
            }
            
            callbacks.on_generation_complete(context)
            
            return context
            
        except Exception as e:
            callbacks.on_error(context, e)
            raise
    
    def _prepare_generation_params(self, config, prompt, override_prompt, context, **kwargs):
        """Prepare generation parameters from config and overrides"""
        final_prompt = format_prompt(config.program_id if hasattr(config, 'program_id') else context.program_id, 
                                    prompt, override_prompt)
        
        # Get dimensions (randomize for LoRA if needed)
        width, height = config.width, config.height
        if config.pipeline_type == "lora":
            # Use set_id as seed for deterministic randomization
            width, height = get_lora_size(seed=context.set_id)
        
        params = {
            'prompt': final_prompt,
            'num_inference_steps': kwargs.get('num_inference_steps', config.inference_steps),
            'guidance_scale': kwargs.get('guidance_scale', config.guidance_scale),
            'width': kwargs.get('width', width),
            'height': kwargs.get('height', height),
        }
        
        # Add additional parameters based on pipeline type
        if config.pipeline_type == "img2img":
            params['strength'] = kwargs.get('strength', config.strength)
        
        return params
    
    def _generate_text2img(self, pipeline, params):
        """Generate text-to-image"""
        return pipeline(**params)
    
    def _generate_img2img(self, pipeline, config, params):
        """Generate image-to-image"""
        source_image = self.factory.get_source_image(config)
        if source_image is None:
            raise ValueError(f"Source image not found: {config.source_image}")
        
        params['image'] = source_image
        return pipeline(**params)
    
    def _create_progress_callback(self, context: GenerationContext, callbacks: GenerationCallbacks):
        """Create progress callback function"""
        def progress_callback(pipe, step, timestep, callback_kwargs):
            current_time = time.time()
            
            # Record step timing
            if context.step_start_time is not None:
                duration = current_time - context.step_start_time
                context.step_durations[context.current_step] = duration
            
            # Update step tracking
            context.current_step = step + 1
            context.step_start_time = current_time
            
            # Call mode-specific callbacks
            callbacks.on_step_start(context, step, timestep)
            
            # Check for interruption
            if callbacks.should_interrupt(context):
                context.should_interrupt = True
                pipe._interrupt = True
                return callback_kwargs
            
            # Generate preview image if enabled
            if (GENERATION_CONFIG.get("preview_steps_enabled", True) and 
                "latents" in callback_kwargs):
                
                try:
                    preview_image = self._latents_to_image(callback_kwargs["latents"])
                    callbacks.on_preview_image(context, step + 1, preview_image)
                except Exception as e:
                    print(f"Warning: Could not generate preview image: {e}")
            
            callbacks.on_step_end(context, step, timestep, callback_kwargs.get("latents"))
            
            return callback_kwargs
        
        return progress_callback
    
    def _latents_to_image(self, latents: torch.Tensor) -> PIL.Image.Image:
        """Convert latents to RGB image for preview"""
        # This is a simplified version - you might want to use the actual VAE
        # For now, we'll use a basic normalization approach
        try:
            # Normalize latents to 0-1 range
            latents_normalized = (latents - latents.min()) / (latents.max() - latents.min())
            
            # Convert to numpy and reshape
            latents_np = latents_normalized.detach().cpu().numpy()
            
            # Simple RGB conversion (this is a placeholder - use actual VAE in production)
            if len(latents_np.shape) == 4:  # [batch, channels, height, width]
                latents_np = latents_np[0]  # Take first batch item
            
            if latents_np.shape[0] >= 3:  # If we have at least 3 channels
                rgb_array = latents_np[:3].transpose(1, 2, 0)  # [height, width, channels]
            else:
                # Grayscale to RGB
                gray = latents_np[0] if len(latents_np.shape) > 2 else latents_np
                rgb_array = np.stack([gray, gray, gray], axis=-1)
            
            # Scale to 0-255 and convert to uint8
            rgb_array = (rgb_array * 255).astype(np.uint8)
            
            return PIL.Image.fromarray(rgb_array)
            
        except Exception as e:
            # Fallback: create a placeholder image
            import numpy as np
            placeholder = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8)
            return PIL.Image.fromarray(placeholder)

# Utility functions for common operations
def generate_for_program(program_id: str, prompt: str, **kwargs) -> GenerationContext:
    """Convenience function for simple generation"""
    ops = PipelineOperations()
    return ops.generate_image(program_id, prompt, **kwargs)

def batch_generate(program_id: str, prompts: list, **kwargs) -> list:
    """Generate multiple images for the same program"""
    ops = PipelineOperations()
    results = []
    
    for i, prompt in enumerate(prompts):
        context = ops.generate_image(
            program_id, 
            prompt, 
            action_id=kwargs.get('action_id', f'batch_{i}'),
            set_id=i,
            **kwargs
        )
        results.append(context)
    
    return results