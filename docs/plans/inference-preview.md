# Inference Previews

Let's add an ability to do inference previews to `text_to_image.py`. See the main README.md for how this is supposed to work. This is only applicable to Program 1 onwards, as Program 0 does not require in-between images.

The gist is that we want to show the in-between images where the noise diffusion steps are shown, so that the audience can see how the image is generated in real-time. Refer to the `pipeline_manager.py` and `latents.py` (the latent extraction implementation) file in the `legacy-api` for how this is done.

We don't need all the complexity of websockets and live generation in `pipeline_manager.py` at all, because we don't need to live-report the images. Instead, we save each in-between images to the object storage.

For Program 0, the current path is correct, as we do not need the in-between images in P0.

`f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/final.png"`

For Program 1 onwards, an in-between image is required:

- in-between images: `f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/{step_id}.png"`, where the `step_id` is the inference step number (e.g. from 1 to LAST_INFERENCE_STEP).
- final image: `f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/final.png"`

We must also measure the time it takes between each step in milliseconds, and save it to the timing metadata JSON file: `f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/timing.json"`. This metadata contains the timing information. `"final"` is the time it takes to generate the final image after the last inference step.

```json
{
  "stepDurations": {
    "1": 1000,
    "2": 300,
    "3": 400,
    "4": 800,
    "final": 1000
  }
}
```

## Implementation Plan

### Overview

Based on analysis of the existing codebase, the inference preview functionality needs to be added to the serverless backend at `serverless/pregen/text_to_image.py`. This will enable the system to show intermediate diffusion steps during image generation for Programs 1-4, while maintaining the existing behavior for Program 0.

### Key Components Analysis

#### Existing Implementation
- **Current Pipeline**: Uses `StableDiffusion3Pipeline` from diffusers library
- **Programs**: P0, P3, P3B, P4 supported (P0 = no previews, P1-4 = previews needed)
- **Storage**: Images uploaded to Cloudflare R2 with structured paths
- **Timing**: Basic inference timing already measured (lines 204, 218)

#### Legacy Reference Implementation
- **`pipeline_manager.py`**: Shows how to capture intermediate steps using `callback_kwargs["latents"]`
- **`latents.py`**: Provides `latents_to_rgb()` function to convert latents to viewable images
- **WebSocket Pattern**: Uses `on_step_end` callback to capture each diffusion step

### Implementation Strategy

#### 1. Add Callback Support to StableDiffusion3Pipeline

**Location**: `serverless/pregen/text_to_image.py`, in the `run()` method around line 207

**Changes**:
- Add a custom callback function to capture intermediate steps
- Use the existing `latents_to_rgb()` conversion logic (need to port from legacy)
- Store intermediate images and timing data during generation

#### 2. Enhanced Storage Structure

**Current**: `foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/final.png`

**New Structure**:
```
foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/
├── 1.png              # Step 1 intermediate
├── 2.png              # Step 2 intermediate
├── ...
├── {num_steps}.png    # Last step intermediate
├── final.png          # Final processed image
└── timing.json        # Step timing metadata
```

#### 3. Program-Specific Logic

**Program 0 (P0)**: 
- Keep existing behavior (no intermediate steps)
- Only save final.png

**Programs 1-4 (P1, P3, P3B, P4)**:
- Enable intermediate step capture
- Save each step + timing data
- Save final image + final processing time

### Detailed Implementation Tasks

#### Task 1: Port Latents Conversion Logic
- Copy `latents_to_rgb()` from `legacy-api/utils/latents.py`
- Add required imports: `torch`, `PIL.Image as PILImage`
- Verify tensor conversion works with SD3 pipeline latents

**Implementation Details**:
```python
import torch
import PIL.Image as PILImage

# Port from legacy-api/utils/latents.py
WEIGHTS = ((60, -60, 25, -70), (60, -5, 15, -50), (60, 10, -5, -35))

def latents_to_rgb(latents):
    """Convert diffusion latents to viewable RGB image"""
    weights_tensor = torch.t(
        torch.tensor(WEIGHTS, dtype=latents.dtype).to(latents.device)
    )
    biases_tensor = torch.tensor((150, 140, 130), dtype=latents.dtype).to(
        latents.device
    )
    weights_s = torch.einsum("...lxy,lr -> ...rxy", latents, weights_tensor)
    biases_s = biases_tensor.unsqueeze(-1).unsqueeze(-1)
    rgb_tensor = weights_s + biases_s
    image_array = rgb_tensor.clamp(0, 255)[0].byte().cpu().numpy()
    image_array = image_array.transpose(1, 2, 0)

    return PILImage.fromarray(image_array)
```

**Usage in Callback**:
The function takes the raw latents tensor from `callback_kwargs["latents"]` and converts it directly to a PIL Image that can be saved as PNG. The latents tensor is in the diffusion model's internal representation, and this function converts it to a viewable RGB image showing the current generation state.

#### Task 2: Create Step Callback Function
```python
def create_step_callback(program_key, cue_id, variant_id, step_timings):
    """Creates callback to capture intermediate steps"""
    def on_step_end(pipe, step, timestep, callback_kwargs):
        # Only capture for P1-P4, skip P0
        if program_key == "P0":
            return callback_kwargs
            
        # Record step timing
        current_time = time.time()
        step_timings[str(step)] = current_time
        
        # Extract and convert latents
        latents = callback_kwargs["latents"]
        preview_image = latents_to_rgb(latents)
        
        # Save intermediate image to R2
        with io.BytesIO() as buf:
            preview_image.convert("RGB").save(buf, format="PNG")
            image_bytes = buf.getvalue()
            
        step_key = f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/{step}.png"
        upload_to_r2(image_bytes, step_key)
        
        return callback_kwargs
    return on_step_end
```

#### Task 3: Modify Main Generation Logic
**Location**: `run()` method, around line 207

**Changes**:
1. Initialize step timing tracking
2. Create program-specific callback
3. Pass callback to pipeline
4. Generate and save timing metadata

#### Task 4: Timing Metadata Generation
```python
def save_timing_metadata(step_timings, start_time, final_time, cue_id, variant_id):
    """Generate and save timing.json with step durations"""
    durations = {}
    prev_time = start_time
    
    for step, timestamp in step_timings.items():
        durations[step] = int((timestamp - prev_time) * 1000)  # Convert to ms
        prev_time = timestamp
        
    # Add final processing time
    durations["final"] = int((final_time - prev_time) * 1000)
    
    metadata = {"stepDurations": durations}
    metadata_json = json.dumps(metadata)
    
    timing_key = f"foigoi/{PREGEN_VERSION_ID}/cues/{cue_id}/{variant_id}/timing.json"
    upload_to_r2(metadata_json.encode(), timing_key)
```

#### Task 5: Update Pipeline Call
**Before**:
```python
images = self.pipe(
    prompt=modified_prompt,
    num_images_per_prompt=1,
    num_inference_steps=num_inference_steps,
    guidance_scale=guidance_scale,
    generator=generator,
    width=width,
    height=height,
).images
```

**After**:
```python
step_timings = {}
start_time = time.time()

if program_key != "P0":
    callback_fn = create_step_callback(program_key, cue_id, variant_id, step_timings)
    images = self.pipe(
        prompt=modified_prompt,
        num_images_per_prompt=1,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
        width=width,
        height=height,
        callback_on_step_end=callback_fn,
    ).images
else:
    # P0: No intermediate steps
    images = self.pipe(
        prompt=modified_prompt,
        num_images_per_prompt=1,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
        width=width,
        height=height,
    ).images
```

### Implementation Considerations

#### Error Handling
- Graceful degradation if intermediate step saving fails
- Ensure final image is always saved regardless of preview failures
- Log upload failures without breaking the generation process

#### Performance Impact
- Intermediate image conversion and upload adds processing time
- Consider async upload for better performance
- Monitor memory usage with multiple intermediate images

#### Backward Compatibility
- Program 0 behavior unchanged
- Existing API contracts maintained
- Frontend can detect preview availability by checking for timing.json

#### Testing Strategy
1. Test P0 generation (should be unchanged)
2. Test P1-P4 generation with intermediate steps
3. Verify R2 upload structure matches specification
4. Validate timing.json format and accuracy
5. Test error scenarios (upload failures, memory issues)

### File Modifications Required

1. **`serverless/pregen/text_to_image.py`**:
   - Add latents conversion function
   - Add step callback creation
   - Modify pipeline execution logic
   - Add timing metadata generation
   - Add required imports (json)

2. **Dependencies**: 
   - No new dependencies required (uses existing diffusers, torch, PIL)

### Timeline Estimate
- **Task 1**: Port latents logic (30 minutes)
- **Task 2**: Create callback function (45 minutes) 
- **Task 3**: Modify generation logic (30 minutes)
- **Task 4**: Timing metadata (30 minutes)
- **Task 5**: Update pipeline calls (15 minutes)
- **Testing**: Full integration testing (60 minutes)

**Total**: ~3.5 hours for complete implementation and testing
