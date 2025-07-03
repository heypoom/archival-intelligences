# Shared Pipeline Infrastructure

This directory contains the shared pipeline infrastructure used across all operation modes (A, B, C) of the Archival Intelligences project.

## Architecture Overview

The shared infrastructure eliminates code duplication and ensures consistent results across all modes by centralizing:

- **Pipeline Configuration**: Single source of truth for models, inference steps, dimensions
- **Pipeline Operations**: Core generation logic with pluggable callbacks  
- **Mode-Specific Adapters**: Handle WebSocket streaming vs HTTP batch vs local execution

## Directory Structure

```
api/shared/
├── pipeline_config.py      # Central configuration for all programs
├── pipeline_factory.py     # Pipeline creation and management
├── pipeline_operations.py  # Core generation logic with callbacks
└── adapters/
    ├── batch_adapter.py     # Mode B: HTTP batch with R2 upload
    ├── websocket_adapter.py # Mode A/C: WebSocket streaming
    └── local_adapter.py     # Local execution (future)
```

## Key Benefits

### ✅ Consistent Configuration
- All modes use same models: SD3.5-turbo, SD-v1.5
- Same inference steps: P0=20, P2=15, P3=20, P4=20  
- Same image dimensions: P0/P4=1360x768, P2=960x800, P3=random
- Same LoRA handling, prompt templates, guidance scales

### ✅ Unified Pipeline Management
- Single pipeline factory with caching and memory management
- Consistent LoRA loading/unloading across modes
- Shared model optimization (xformers, memory offload)
- Common error handling and interruption logic

### ✅ Mode-Specific Adapters
- **WebSocket**: Real-time streaming with progress updates
- **Batch**: R2 upload with metadata generation  
- **Local**: Direct execution for testing/development

## Usage Examples

### Mode B: Batch Generation
```python
from api.shared.adapters.batch_adapter import create_batch_adapter

# Create adapter with R2 credentials
adapter = create_batch_adapter(r2_credentials)

# Generate single set
context = await adapter.generate_single_set(
    program_id="P0",
    prompt="machine learning summit in paris",
    action_id="transcript_001",
    set_id=0
)

# Generate multiple sets
contexts = await adapter.generate_multiple_sets(
    program_id="P0", 
    prompt="ai conference",
    action_id="transcript_002",
    num_sets=5,
    parallel=True
)
```

### Mode A/C: WebSocket Streaming  
```python
from api.shared.adapters.websocket_adapter import WebSocketAdapter

adapter = WebSocketAdapter()

# Handle WebSocket commands
await adapter.handle_generation_command(
    websocket, 
    "P0:machine learning summit",
    conn_id="client_123"
)
```

### Direct Pipeline Usage
```python
from api.shared.pipeline_operations import generate_for_program

# Simple generation
context = generate_for_program(
    program_id="P3",
    prompt="painting of singapore"
)
```

## Migration Path

### Phase 1: Update Modal Batch Endpoints ✅
- Replace separate pipeline code with shared infrastructure
- Use `modal_batch_endpoints_v2.py` which uses shared adapters

### Phase 2: Update WebSocket Endpoints
- Refactor existing `exhibition_text_to_image.py` and `exhibition_image_to_image.py`
- Use `WebSocketAdapter` for consistent pipeline handling

### Phase 3: Update Local Server
- Refactor `/api/server.py` to use shared pipeline operations
- Remove duplicate pipeline code from `/api/utils/`

## Configuration Management

All program configurations are centralized in `pipeline_config.py`:

```python
PROGRAM_CONFIGS = {
    "P0": ProgramConfig(
        model_id="stabilityai/stable-diffusion-3.5-large-turbo",
        pipeline_type="text2img",
        inference_steps=20,
        guidance_scale=7.5,
        width=1360, height=768,
        prompt_template="{prompt}, photorealistic, high quality, detailed"
    ),
    # ... other programs
}
```

Changes to inference steps, models, or dimensions only need to be made in one place.

## Memory Management

The shared factory provides memory management utilities:

```python
# Get memory statistics
stats = adapter.get_memory_stats()

# Clear cache to free memory  
adapter.clear_cache()
```

## Error Handling

Consistent error handling across all modes:

- **Interruption**: WebSocket disconnections, user cancellation
- **Resource Errors**: GPU OOM, model loading failures  
- **Storage Errors**: R2 upload failures, disk space issues
- **Generation Errors**: Invalid prompts, pipeline failures

## Testing

Each adapter can be tested independently:

```python
# Test batch adapter
pytest tests/test_batch_adapter.py

# Test WebSocket adapter  
pytest tests/test_websocket_adapter.py

# Test shared operations
pytest tests/test_pipeline_operations.py
```

## Next Steps

1. **Deploy Modal batch endpoints** using shared infrastructure
2. **Update preprocessor** to use new HTTP endpoints
3. **Refactor WebSocket endpoints** to use shared adapters  
4. **Migrate local server** to shared pipeline operations
5. **Add comprehensive testing** for all adapters