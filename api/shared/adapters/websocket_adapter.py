"""
WebSocket adapter for Mode A/C live generation
Uses shared pipeline operations with streaming callbacks
"""

import io
import asyncio
from typing import Optional, Any
import PIL.Image
import websockets

from ..pipeline_operations import (
    PipelineOperations, 
    GenerationCallbacks, 
    GenerationContext
)

class WebSocketGenerationCallbacks(GenerationCallbacks):
    """Callbacks for WebSocket streaming generation"""
    
    def __init__(self, websocket, conn_id: Optional[str] = None):
        self.websocket = websocket
        self.conn_id = conn_id
        self._connection_state = {}  # Track connection state
    
    def on_generation_start(self, context: GenerationContext):
        """Initialize WebSocket generation"""
        print(f"Starting WebSocket generation: {context.program_id} - {context.action_id}")
    
    def on_step_start(self, context: GenerationContext, step: int, timestep: int):
        """Send step progress to WebSocket"""
        progress_message = f"p:s={step}:t={timestep}"
        asyncio.create_task(self._send_safe(progress_message))
    
    def on_preview_image(self, context: GenerationContext, step: int, image: PIL.Image.Image):
        """Send preview image to WebSocket"""
        try:
            # Convert image to JPEG bytes
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=75)
            image_bytes = buffer.getvalue()
            
            # Send to WebSocket
            asyncio.create_task(self._send_safe(image_bytes))
            
        except Exception as e:
            print(f"Error sending preview image: {e}")
    
    def on_final_image(self, context: GenerationContext, image: PIL.Image.Image):
        """Send final image to WebSocket"""
        try:
            # Convert to PNG for final image
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            image_bytes = buffer.getvalue()
            
            # Send final image
            asyncio.create_task(self._send_safe(image_bytes))
            
        except Exception as e:
            print(f"Error sending final image: {e}")
    
    def on_generation_complete(self, context: GenerationContext):
        """Send completion signal"""
        asyncio.create_task(self._send_safe("done"))
        print(f"WebSocket generation complete: {context.action_id} ({context.metadata.get('total_duration', 0):.1f}s)")
    
    def on_error(self, context: GenerationContext, error: Exception):
        """Send error to WebSocket"""
        error_message = f"error:{str(error)}"
        asyncio.create_task(self._send_safe(error_message))
        print(f"WebSocket generation error: {context.action_id}: {error}")
    
    def should_interrupt(self, context: GenerationContext) -> bool:
        """Check if WebSocket connection is still active"""
        if self.conn_id:
            # Check connection state (integrate with existing connection_state.py)
            from ...utils.connection_state import get_is_connected
            return not get_is_connected(self.conn_id)
        
        # Basic check if websocket is still open
        return self.websocket.closed
    
    async def _send_safe(self, data):
        """Safely send data to WebSocket with error handling"""
        try:
            if isinstance(data, str):
                await self.websocket.send_text(data)
            else:
                await self.websocket.send_bytes(data)
        except Exception as e:
            print(f"Error sending to WebSocket: {e}")

class WebSocketAdapter:
    """Adapter for WebSocket-based generation"""
    
    def __init__(self, cache_dir: str = "/cache"):
        self.operations = PipelineOperations(cache_dir)
    
    async def handle_generation_command(self, 
                                      websocket,
                                      command: str,
                                      conn_id: Optional[str] = None) -> bool:
        """
        Handle a generation command from WebSocket
        Returns True if command was handled, False otherwise
        """
        try:
            # Parse command format: "P0:prompt" or "P2:strength" etc.
            if ":" not in command:
                return False
            
            program_id, params = command.split(":", 1)
            
            # Validate program ID
            if program_id not in ["P0", "P2", "P2B", "P3", "P3B", "P4"]:
                return False
            
            # Setup WebSocket callbacks
            callbacks = WebSocketGenerationCallbacks(websocket, conn_id)
            
            # Generate based on program type
            await self._handle_program_generation(
                program_id, 
                params, 
                callbacks, 
                conn_id
            )
            
            return True
            
        except Exception as e:
            print(f"Error handling WebSocket command '{command}': {e}")
            error_message = f"error:Command failed: {str(e)}"
            await websocket.send_text(error_message)
            return False
    
    async def _handle_program_generation(self, 
                                       program_id: str,
                                       params: str,
                                       callbacks: WebSocketGenerationCallbacks,
                                       conn_id: Optional[str]):
        """Handle generation for specific program"""
        
        # Prepare generation parameters based on program
        if program_id == "P0":
            # Text-to-image with prompt
            prompt = params
            context = self.operations.generate_image(
                program_id=program_id,
                prompt=prompt,
                action_id=f"ws_{conn_id or 'unknown'}",
                callbacks=callbacks
            )
            
        elif program_id in ["P2", "P2B"]:
            # Image-to-image with strength
            try:
                strength = float(params)
            except ValueError:
                strength = 0.8
            
            prompt = "epic poem of malaya"  # Default prompt for P2
            context = self.operations.generate_image(
                program_id=program_id,
                prompt=prompt,
                action_id=f"ws_{conn_id or 'unknown'}",
                callbacks=callbacks,
                strength=strength
            )
            
        elif program_id == "P3":
            # LoRA generation (no params needed)
            prompt = "chua mia tee painting"
            context = self.operations.generate_image(
                program_id=program_id,
                prompt=prompt,
                action_id=f"ws_{conn_id or 'unknown'}",
                callbacks=callbacks
            )
            
        elif program_id == "P3B":
            # LoRA with custom prompt
            prompt = params if params else "chua mia tee painting"
            context = self.operations.generate_image(
                program_id=program_id,
                prompt=prompt,
                action_id=f"ws_{conn_id or 'unknown'}",
                callbacks=callbacks
            )
            
        elif program_id == "P4":
            # People generation
            prompt = params if params else "person"
            context = self.operations.generate_image(
                program_id=program_id,
                prompt=prompt,
                action_id=f"ws_{conn_id or 'unknown'}",
                callbacks=callbacks
            )
    
    def get_memory_stats(self):
        """Get memory usage statistics"""
        return self.operations.factory.get_memory_stats()
    
    def clear_cache(self):
        """Clear pipeline cache"""
        self.operations.factory.clear_cache()

# Integration example for existing server.py
async def integrate_with_existing_server(websocket, path):
    """
    Example integration with existing WebSocket server
    This would replace the current program-specific functions
    """
    adapter = WebSocketAdapter()
    
    try:
        async for message in websocket:
            if isinstance(message, str):
                # Handle text commands
                command_handled = await adapter.handle_generation_command(
                    websocket, 
                    message,
                    conn_id=getattr(websocket, 'conn_id', None)
                )
                
                if not command_handled:
                    # Handle other non-generation commands
                    await websocket.send_text(f"Unknown command: {message}")
            else:
                # Handle binary messages if needed
                pass
                
    except websockets.exceptions.ConnectionClosed:
        print("WebSocket connection closed")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_text(f"error:Server error: {str(e)}")

# Convenience function for creating WebSocket adapter
def create_websocket_adapter(cache_dir: str = "/cache") -> WebSocketAdapter:
    """Create WebSocket adapter with shared pipeline"""
    return WebSocketAdapter(cache_dir)