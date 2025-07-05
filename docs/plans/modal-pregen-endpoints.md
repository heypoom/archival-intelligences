# Modal Pregeneration Endpoints Plan

## Goal

Create two HTTP endpoints on Modal in `serverless/pregen` that return images given a program key (e.g. "P4") and prompt (e.g. "big tech ceo"). This serves as the foundation for our pregeneration system.

## Tasks

1. Explore existing serverless structure and Modal setup
2. Create Modal HTTP endpoints in serverless/pregen for image generation
3. Implement program key and prompt parameter handling
4. Test endpoints with sample requests

## Endpoints Design

### Endpoint 1: `/generate/text-to-image`

- **Method**: POST
- **Parameters**:
  - `program_key`: string (e.g. "P4" or "P3B")
    - refer to `ui/` for the list of programs
  - `prompt`: string (e.g. "big tech ceo")
  - `lora`: "chua-mia-tee" | "none" (optional, default: "none")
    - "chua-mia-tee" applies the LoRA trained on Chua Mia Tee's painting style. This is used for Program 3.
- **Response**: Generated image in binary format.

### Endpoint 2: `/generate/malaya`

This is used for Program 2 and 2B, which uses the image of "Epic Poem of Malaya" as a base image and generates variations based on the prompt.

- **Method**: POST
- **Parameters**:
  - `prompt`: string (e.g. "painting like an epic poem of malaya")
- **Response**: JSON with preview steps and final image

## Implementation Notes

- Refer to existing patterns (e.g. diffusion pipeline configuration) from `legacy-api/`
- Import shared logic from `serverless/common/`, such as diffusion pipeline setup.
- Keep it simple for now - focus on basic functionality
- Program key will determine which AI model/pipeline to use
- In the future, both endpoints will save directly to an object storage like R2, and return a JSON with the image URL and metadata. The preview is for testing for now.
