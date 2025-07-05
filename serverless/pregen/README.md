# Pregeneration Endpoints

Simple HTTP endpoints for generating images used in the exhibition pregeneration system.

## Endpoints

### Text-to-Image (`text_to_image.py`)
- **Programs**: P0, P3, P3B, P4  
- **Model**: stabilityai/stable-diffusion-3.5-large-turbo
- **Features**: LoRA support for Chua Mia Tee painting style (P3/P3B)

### Malaya (`malaya.py`)
- **Programs**: P2, P2B
- **Model**: runwayml/stable-diffusion-v1-5
- **Features**: Image-to-image using Epic Poem of Malaya base image

## Usage

### Deploy endpoints:
```bash
modal deploy text_to_image.py
modal deploy malaya.py
```

### Run locally for development:
```bash
# Serve endpoints locally
make serve-text
make serve-malaya

# Test endpoints (with curl)
make test-text
make test-malaya
```

### API Usage

Both endpoints accept POST requests to `/generate`:

```python
import requests

# Text-to-image
response = requests.post("https://your-app.modal.run/generate", json={
    "program_key": "P4",
    "prompt": "big tech ceo",
    "seed": 12345
})

# Malaya image-to-image  
response = requests.post("https://your-malaya-app.modal.run/generate", json={
    "program_key": "P2",
    "prompt": "painting like an epic poem of malaya",
    "seed": 12345
})

# Save the image
with open("generated.png", "wb") as f:
    f.write(response.content)
```

## Program Key Reference

- **P0**: Live speech → text-to-image
- **P2**: "Epic poem of malaya" → image-to-image (guidance: 7.5)
- **P2B**: "with more people" → image-to-image (guidance: 8.5)
- **P3**: "mia tee painting" → text-to-image with LoRA
- **P3B**: "chua mia tee painting" → text-to-image with LoRA + regeneration
- **P4**: Freeform generation → text-to-image

## Requirements

- Modal account and CLI configured
- HuggingFace secret configured in Modal
- `malaya.png` base image for image-to-image endpoints