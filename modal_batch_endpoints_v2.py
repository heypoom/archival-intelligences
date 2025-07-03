"""
Modal HTTP endpoints for Mode B batch generation
Uses shared pipeline infrastructure for consistency across all modes
"""

import modal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# Import shared pipeline components
from api.shared.adapters.batch_adapter import BatchAdapter, create_batch_adapter

app = modal.App("archival-intelligences-batch")

# Base image with shared dependencies
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install([
        "fastapi[standard]>=0.115.4",
        "diffusers>=0.31.0", 
        "torch>=2.5.1",
        "transformers~=4.44.0",
        "accelerate>=0.33.0",
        "peft>=0.13.0",
        "boto3>=1.35.0",
        "botocore>=1.35.0",
        "pillow>=10.0.0",
        "numpy>=1.24.0",
    ])
    .apt_install(["wget", "curl"])
    # Copy shared pipeline code into the container
    .copy_local_dir("api/shared", "/app/api/shared")
    # Copy assets (LoRA, source images)
    .copy_local_file("api/chuamiatee.safetensors", "/app/chuamiatee.safetensors")
    .copy_local_file("api/malaya.png", "/app/malaya.png")
)

# Volume for model cache
volume = modal.Volume.from_name("archival-intelligences-cache", create_if_missing=True)

# Request/Response Models
class BatchGenerationRequest(BaseModel):
    action_id: str
    set_id: int
    program: str  # P0, P2, P2B, P3, P3B, P4
    prompt: str
    override_prompt: Optional[str] = None
    guidance_scale: Optional[float] = None
    num_inference_steps: Optional[int] = None
    strength: Optional[float] = None  # For image-to-image
    width: Optional[int] = None
    height: Optional[int] = None
    upload_to_r2: bool = True
    upload_previews: bool = True

class BatchGenerationResponse(BaseModel):
    success: bool
    action_id: str
    set_id: int
    program: str
    total_duration: float
    preview_urls: List[Dict[str, Any]]
    final_url: Optional[str]
    metadata_url: Optional[str]
    error: Optional[str] = None

# Single Set Generation Endpoint
@app.function(
    image=base_image,
    gpu="H100",
    volumes={"/cache": volume},
    secrets=[
        modal.Secret.from_name("huggingface"), 
        modal.Secret.from_name("r2-credentials")
    ],
    timeout=600,
    container_idle_timeout=300,
)
@modal.web_endpoint(method="POST")
async def generate_single_set(request: BatchGenerationRequest):
    """Generate a single image set using shared pipeline infrastructure"""
    
    try:
        # Get R2 credentials from secrets
        r2_credentials = {
            "account_id": modal.Secret.from_name("r2-credentials").get("R2_ACCOUNT_ID"),
            "access_key": modal.Secret.from_name("r2-credentials").get("R2_ACCESS_KEY_ID"),
            "secret_key": modal.Secret.from_name("r2-credentials").get("R2_SECRET_ACCESS_KEY"),
            "bucket_name": modal.Secret.from_name("r2-credentials").get("R2_BUCKET_NAME")
        }
        
        # Create batch adapter with shared pipeline
        adapter = create_batch_adapter(r2_credentials, cache_dir="/cache")
        
        # Generate using shared pipeline operations
        context = await adapter.generate_single_set(
            program_id=request.program,
            prompt=request.prompt,
            action_id=request.action_id,
            set_id=request.set_id,
            override_prompt=request.override_prompt,
            guidance_scale=request.guidance_scale,
            num_inference_steps=request.num_inference_steps,
            strength=request.strength,
            width=request.width,
            height=request.height,
            upload_to_r2=request.upload_to_r2,
            upload_previews=request.upload_previews
        )
        
        # Extract response data from context
        preview_urls = context.metadata.get('preview_urls', [])
        final_url = context.metadata.get('final_url')
        metadata_url = f"https://{r2_credentials['bucket_name']}.r2.dev/actions/{request.action_id}/sets/{request.set_id}/meta.json"
        
        return BatchGenerationResponse(
            success=True,
            action_id=request.action_id,
            set_id=request.set_id,
            program=request.program,
            total_duration=context.metadata.get('total_duration', 0.0),
            preview_urls=preview_urls,
            final_url=final_url,
            metadata_url=metadata_url if request.upload_to_r2 else None
        )
        
    except Exception as e:
        return BatchGenerationResponse(
            success=False,
            action_id=request.action_id,
            set_id=request.set_id,
            program=request.program,
            total_duration=0.0,
            preview_urls=[],
            final_url=None,
            metadata_url=None,
            error=str(e)
        )

# Multiple Sets Generation Endpoint
class MultipleSetsRequest(BaseModel):
    action_id: str
    program: str
    prompt: str
    num_sets: int = 5
    override_prompt: Optional[str] = None
    guidance_scale: Optional[float] = None
    num_inference_steps: Optional[int] = None
    strength: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    upload_to_r2: bool = True
    upload_previews: bool = True
    parallel: bool = True

class MultipleSetsResponse(BaseModel):
    success: bool
    action_id: str
    program: str
    total_sets: int
    successful_sets: int
    total_duration: float
    sets: List[BatchGenerationResponse]

@app.function(
    image=base_image,
    gpu="H100",
    volumes={"/cache": volume},
    secrets=[
        modal.Secret.from_name("huggingface"), 
        modal.Secret.from_name("r2-credentials")
    ],
    timeout=1800,  # 30 minutes for multiple sets
    container_idle_timeout=300,
)
@modal.web_endpoint(method="POST")
async def generate_multiple_sets(request: MultipleSetsRequest):
    """Generate multiple sets for the same action"""
    
    import time
    start_time = time.time()
    
    try:
        # Get R2 credentials
        r2_credentials = {
            "account_id": modal.Secret.from_name("r2-credentials").get("R2_ACCOUNT_ID"),
            "access_key": modal.Secret.from_name("r2-credentials").get("R2_ACCESS_KEY_ID"),
            "secret_key": modal.Secret.from_name("r2-credentials").get("R2_SECRET_ACCESS_KEY"),
            "bucket_name": modal.Secret.from_name("r2-credentials").get("R2_BUCKET_NAME")
        }
        
        # Create batch adapter
        adapter = create_batch_adapter(r2_credentials, cache_dir="/cache")
        
        # Generate multiple sets
        contexts = await adapter.generate_multiple_sets(
            program_id=request.program,
            prompt=request.prompt,
            action_id=request.action_id,
            num_sets=request.num_sets,
            override_prompt=request.override_prompt,
            guidance_scale=request.guidance_scale,
            num_inference_steps=request.num_inference_steps,
            strength=request.strength,
            width=request.width,
            height=request.height,
            upload_to_r2=request.upload_to_r2,
            parallel=request.parallel
        )
        
        # Convert contexts to responses
        set_responses = []
        successful_sets = 0
        
        for context in contexts:
            preview_urls = context.metadata.get('preview_urls', [])
            final_url = context.metadata.get('final_url')
            metadata_url = f"https://{r2_credentials['bucket_name']}.r2.dev/actions/{request.action_id}/sets/{context.set_id}/meta.json"
            
            has_error = 'error' in context.metadata
            if not has_error:
                successful_sets += 1
            
            set_response = BatchGenerationResponse(
                success=not has_error,
                action_id=request.action_id,
                set_id=context.set_id,
                program=request.program,
                total_duration=context.metadata.get('total_duration', 0.0),
                preview_urls=preview_urls,
                final_url=final_url,
                metadata_url=metadata_url if request.upload_to_r2 else None,
                error=context.metadata.get('error')
            )
            set_responses.append(set_response)
        
        total_duration = time.time() - start_time
        
        return MultipleSetsResponse(
            success=successful_sets > 0,
            action_id=request.action_id,
            program=request.program,
            total_sets=request.num_sets,
            successful_sets=successful_sets,
            total_duration=total_duration,
            sets=set_responses
        )
        
    except Exception as e:
        return MultipleSetsResponse(
            success=False,
            action_id=request.action_id,
            program=request.program,
            total_sets=request.num_sets,
            successful_sets=0,
            total_duration=time.time() - start_time,
            sets=[]
        )

# Health Check Endpoint
@app.function(image=base_image)
@modal.web_endpoint(method="GET")
async def health():
    """Health check endpoint for batch generation service"""
    return {
        "status": "healthy",
        "service": "archival-intelligences-batch",
        "version": "2.0.0",
        "timestamp": time.time()
    }

# Memory Statistics Endpoint
@app.function(
    image=base_image,
    volumes={"/cache": volume},
    secrets=[modal.Secret.from_name("r2-credentials")]
)
@modal.web_endpoint(method="GET")
async def memory_stats():
    """Get memory usage statistics"""
    try:
        r2_credentials = {
            "account_id": modal.Secret.from_name("r2-credentials").get("R2_ACCOUNT_ID"),
            "access_key": modal.Secret.from_name("r2-credentials").get("R2_ACCESS_KEY_ID"),
            "secret_key": modal.Secret.from_name("r2-credentials").get("R2_SECRET_ACCESS_KEY"),
            "bucket_name": modal.Secret.from_name("r2-credentials").get("R2_BUCKET_NAME")
        }
        
        adapter = create_batch_adapter(r2_credentials, cache_dir="/cache")
        stats = adapter.get_memory_stats()
        
        return {
            "status": "success",
            "memory_stats": stats,
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": time.time()
        }

# Clear Cache Endpoint (for memory management)
@app.function(
    image=base_image,
    volumes={"/cache": volume},
    secrets=[modal.Secret.from_name("r2-credentials")]
)
@modal.web_endpoint(method="POST")
async def clear_cache():
    """Clear pipeline cache to free memory"""
    try:
        r2_credentials = {
            "account_id": modal.Secret.from_name("r2-credentials").get("R2_ACCOUNT_ID"),
            "access_key": modal.Secret.from_name("r2-credentials").get("R2_ACCESS_KEY_ID"),
            "secret_key": modal.Secret.from_name("r2-credentials").get("R2_SECRET_ACCESS_KEY"),
            "bucket_name": modal.Secret.from_name("r2-credentials").get("R2_BUCKET_NAME")
        }
        
        adapter = create_batch_adapter(r2_credentials, cache_dir="/cache")
        adapter.clear_cache()
        
        return {
            "status": "success",
            "message": "Cache cleared successfully",
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": time.time()
        }