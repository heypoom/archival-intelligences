# Modal Pregeneration Endpoints Implementation Plan

## Overview
Create two simple HTTP endpoints in `serverless/pregen/` that return generated images based on program keys and prompts, serving as foundation for the pregeneration system.

## Files to Create

### 1. `serverless/pregen/text_to_image.py`
- Modal app with HTTP endpoints (not WebSocket)
- Reuse existing patterns from `live_text_to_image.py`
- Support all program types: P0, P3, P3B, P4
- Handle LoRA loading for P3/P3B (Chua Mia Tee painting style)
- Return binary image data directly

### 2. `serverless/pregen/malaya.py` 
- Modal app for P2/P2B programs
- Reuse patterns from `live_image_to_image.py`
- Load "Epic Poem of Malaya" base image
- Handle image-to-image generation with strength/guidance parameters
- Return binary image data directly

## Implementation Details

### Endpoint 1: `/generate/text-to-image`
- **Method**: POST
- **Parameters**: `program_key` (P0/P3/P3B/P4), `prompt`, optional `lora` 
- **Logic**: 
  - P3/P3B: Enable LoRA for Chua Mia Tee style
  - P0/P4: Standard text-to-image
  - Use same model as live version: `stabilityai/stable-diffusion-3.5-large-turbo`
- **Response**: Binary PNG image

### Endpoint 2: `/generate/image-to-image`
- **Method**: POST  
- **Parameters**: `program_key` (P2/P2B), `prompt`
- **Logic**:
  - Load malaya.png as base image
  - P2B: Higher guidance scale (8.5 vs 7.5)
  - Use same model as live version: `runwayml/stable-diffusion-v1-5`
- **Response**: Binary PNG image

## Key Simplifications
- Remove WebSocket/queue complexity - use direct HTTP calls
- Remove preview generation - return final images only
- Remove file saving - return images directly in response
- Reuse existing model configurations and LoRA weights
- Keep same GPU requirements (H100) and dependencies

## Testing Strategy
- Create simple test scripts to call endpoints with sample program keys
- Verify P3 LoRA loading works correctly
- Test P2 image-to-image with malaya base image
- Ensure responses are valid binary image data

## Program Mapping Reference
Based on frontend analysis:
- **P0**: Live speech → text-to-image (30s timeout)
- **P2**: "Epic poem of malaya" → image-to-image with guidance
- **P2B**: "with more people" → image-to-image with higher guidance (8.5)
- **P3**: "mia tee painting" → text-to-image with LoRA
- **P3B**: "chua mia tee painting" → text-to-image with LoRA + regeneration
- **P4**: Freeform generation → text-to-image (data researcher, crowdworker, big tech ceo)