"""
Batch adapter for Mode B static generation
Uses shared pipeline operations with R2 upload and metadata collection
"""

import io
import json
import time
import asyncio
from typing import List, Dict, Any, Optional
import PIL.Image
import boto3
from botocore.config import Config

from ..pipeline_operations import (
    PipelineOperations, 
    GenerationCallbacks, 
    GenerationContext
)
from ..pipeline_config import R2_CONFIG

class R2StorageClient:
    """R2 storage client for batch uploads"""
    
    def __init__(self, account_id: str, access_key: str, secret_key: str, bucket_name: str):
        self.client = boto3.client(
            's3',
            region_name='auto',
            endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version='s3v4')
        )
        self.bucket_name = bucket_name
    
    async def upload_image(self, key: str, image: PIL.Image.Image, format: str = "JPEG", quality: int = 75) -> str:
        """Upload image to R2 storage"""
        buffer = io.BytesIO()
        
        if format.upper() == "JPEG":
            image.save(buffer, format="JPEG", quality=quality)
            content_type = "image/jpeg"
        else:
            image.save(buffer, format="PNG")
            content_type = "image/png"
        
        # Run upload in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=buffer.getvalue(),
                ContentType=content_type,
                ACL='public-read'
            )
        )
        
        return f"https://{self.bucket_name}.r2.dev/{key}"
    
    async def upload_metadata(self, key: str, metadata: Dict[str, Any]) -> str:
        """Upload metadata JSON to R2"""
        metadata_json = json.dumps(metadata, indent=2)
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=metadata_json.encode('utf-8'),
                ContentType="application/json",
                ACL='public-read'
            )
        )
        
        return f"https://{self.bucket_name}.r2.dev/{key}"

class BatchGenerationCallbacks(GenerationCallbacks):
    """Callbacks for batch generation with R2 upload"""
    
    def __init__(self, r2_client: Optional[R2StorageClient] = None, upload_previews: bool = True):
        self.r2_client = r2_client
        self.upload_previews = upload_previews
        self.preview_urls: List[str] = []
        self.final_url: Optional[str] = None
        self.upload_tasks: List[asyncio.Task] = []
    
    def on_generation_start(self, context: GenerationContext):
        """Initialize generation tracking"""
        context.metadata['preview_urls'] = []
        context.metadata['upload_errors'] = []
        print(f"Starting generation: {context.action_id}/set_{context.set_id}")
    
    def on_preview_image(self, context: GenerationContext, step: int, image: PIL.Image.Image):
        """Handle preview image with optional R2 upload"""
        if self.r2_client and self.upload_previews:
            # Create upload task
            key = f"actions/{context.action_id}/sets/{context.set_id}/{step}.jpg"
            task = asyncio.create_task(
                self._upload_preview_image(context, key, image, step)
            )
            self.upload_tasks.append(task)
    
    def on_final_image(self, context: GenerationContext, image: PIL.Image.Image):
        """Handle final image with R2 upload"""
        if self.r2_client:
            key = f"actions/{context.action_id}/sets/{context.set_id}/final.png"
            task = asyncio.create_task(
                self._upload_final_image(context, key, image)
            )
            self.upload_tasks.append(task)
    
    def on_generation_complete(self, context: GenerationContext):
        """Wait for all uploads to complete and generate metadata"""
        if self.upload_tasks:
            # Wait for all uploads to complete
            loop = asyncio.get_event_loop()
            loop.run_until_complete(asyncio.gather(*self.upload_tasks, return_exceptions=True))
        
        # Generate final metadata
        if self.r2_client:
            metadata_key = f"actions/{context.action_id}/sets/{context.set_id}/meta.json"
            metadata = self._create_metadata(context)
            
            upload_task = asyncio.create_task(
                self.r2_client.upload_metadata(metadata_key, metadata)
            )
            loop = asyncio.get_event_loop()
            loop.run_until_complete(upload_task)
        
        print(f"Generation complete: {context.action_id}/set_{context.set_id} ({context.metadata['total_duration']:.1f}s)")
    
    def on_error(self, context: GenerationContext, error: Exception):
        """Handle generation errors"""
        print(f"Generation error: {context.action_id}/set_{context.set_id}: {error}")
        context.metadata['error'] = str(error)
    
    async def _upload_preview_image(self, context: GenerationContext, key: str, 
                                  image: PIL.Image.Image, step: int):
        """Upload preview image to R2"""
        try:
            url = await self.r2_client.upload_image(
                key, 
                image, 
                format=R2_CONFIG["preview_format"].upper(),
                quality=R2_CONFIG["preview_quality"]
            )
            context.metadata['preview_urls'].append({
                'step': step,
                'url': url,
                'duration': context.step_durations.get(step, 0.0)
            })
        except Exception as e:
            context.metadata['upload_errors'].append(f"Preview step {step}: {e}")
    
    async def _upload_final_image(self, context: GenerationContext, key: str, image: PIL.Image.Image):
        """Upload final image to R2"""
        try:
            url = await self.r2_client.upload_image(
                key,
                image,
                format=R2_CONFIG["final_format"].upper()
            )
            context.metadata['final_url'] = url
        except Exception as e:
            context.metadata['upload_errors'].append(f"Final image: {e}")
    
    def _create_metadata(self, context: GenerationContext) -> Dict[str, Any]:
        """Create metadata JSON for the generation"""
        return {
            "cue_id": context.action_id,
            "set_id": context.set_id,
            "total_steps": len(context.step_durations),
            "durations": context.step_durations,
            "total_duration": context.metadata.get('total_duration', 0.0),
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "model_config": context.metadata.get('generation_config', {}),
            "preview_urls": context.metadata.get('preview_urls', []),
            "final_url": context.metadata.get('final_url'),
            "upload_errors": context.metadata.get('upload_errors', [])
        }

class BatchAdapter:
    """Adapter for batch generation operations"""
    
    def __init__(self, r2_client: Optional[R2StorageClient] = None, cache_dir: str = "/cache"):
        self.operations = PipelineOperations(cache_dir)
        self.r2_client = r2_client
    
    async def generate_single_set(self, 
                                program_id: str,
                                prompt: str,
                                action_id: str,
                                set_id: int = 0,
                                upload_to_r2: bool = True,
                                upload_previews: bool = True,
                                **kwargs) -> GenerationContext:
        """Generate a single image set with R2 upload"""
        
        # Setup callbacks for batch generation
        callbacks = BatchGenerationCallbacks(
            r2_client=self.r2_client if upload_to_r2 else None,
            upload_previews=upload_previews
        )
        
        # Generate image
        context = self.operations.generate_image(
            program_id=program_id,
            prompt=prompt,
            action_id=action_id,
            set_id=set_id,
            callbacks=callbacks,
            **kwargs
        )
        
        return context
    
    async def generate_multiple_sets(self,
                                   program_id: str,
                                   prompt: str,
                                   action_id: str,
                                   num_sets: int = 5,
                                   upload_to_r2: bool = True,
                                   parallel: bool = True,
                                   **kwargs) -> List[GenerationContext]:
        """Generate multiple sets for the same action"""
        
        if parallel:
            # Generate sets in parallel
            tasks = []
            for set_id in range(num_sets):
                task = self.generate_single_set(
                    program_id=program_id,
                    prompt=prompt,
                    action_id=action_id,
                    set_id=set_id,
                    upload_to_r2=upload_to_r2,
                    **kwargs
                )
                tasks.append(task)
            
            results = await asyncio.gather(*tasks)
            return results
        else:
            # Generate sets sequentially
            results = []
            for set_id in range(num_sets):
                context = await self.generate_single_set(
                    program_id=program_id,
                    prompt=prompt,
                    action_id=action_id,
                    set_id=set_id,
                    upload_to_r2=upload_to_r2,
                    **kwargs
                )
                results.append(context)
            
            return results
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory usage statistics"""
        return self.operations.factory.get_memory_stats()
    
    def clear_cache(self):
        """Clear pipeline cache to free memory"""
        self.operations.factory.clear_cache()

# Convenience function for creating configured batch adapter
def create_batch_adapter(r2_credentials: Dict[str, str], cache_dir: str = "/cache") -> BatchAdapter:
    """Create batch adapter with R2 client"""
    r2_client = R2StorageClient(
        account_id=r2_credentials["account_id"],
        access_key=r2_credentials["access_key"],
        secret_key=r2_credentials["secret_key"],
        bucket_name=r2_credentials["bucket_name"]
    )
    
    return BatchAdapter(r2_client=r2_client, cache_dir=cache_dir)