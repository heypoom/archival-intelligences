# Archival Intelligences Lecture Program

The lecture program is used for Ho Rui An's performance lecture and exhibitions.

## Lecture's Structure

This program follows the structure of the performance lecture by Ho Rui An, and has two main sections, Program 0 and Program 1-4:

- Program 0: generates image based on live text-to-speech input from the artist.
  For non-live modes, it uses the pre-recorded talk transcript and invokes the
  image generation endpoint to generate images along with the talk.
- Program 1 - 4: generates image based on various conditions,
  e.g. Chua Mia Tee painting LoRa. Data Researcher, Crowdworker and Big Tech CEO images. This is mostly text-to-image, but has one image-to-image pipeline.

## Operation Modes

### A. Live Lecture

Used for performing live lectures.

This is used by the artist to perform the lectures in real-time. They can interact with the program using text-to-speech and keyboard.

### B. Pre-randomized Image Generation

This is used for the long-running exhibition.

The idea is that we really do not want to run the generation live,
as the GPU servers could have downtime, or something went wrong with the server.

At the same time, the goal is to make the generation feels "live",
which means it has different sets of images.

The full procedure is to:

1. Get the full actions list from the talk, which is created from the transcript. The actions list dictates what actions to simulate e.g. typing on an input box, clearing the input box, going to the next page, speaking into the microphone (which adds to the transcript)
2. If the action is to generate an image, we instead run the generation S times, where S is the number of randomized image sets we want. This gives us S different sets that we can pick from for the performance.
3. In the live version, the duration for generating each intermediary image (i.e. the colorful blob image that is created from the internal tensor in image generation) varies. We record the amount of time the generation takes and save it as a JSON. However, we can use `Math.random()` and simply randomize a fake duration between 0.3 - 1 seconds to fake the effect of "AI is generating your image live".
4. We produce a complimentary JSON for the generated images + durations, which directly maps to the list of actions. This means that for Mode B, every time the image generation action is requested (denoted as A), we lookup the pre-generated images from S sets of images. Example: `actions/<A>/sets/<S>`. This means that every run will be completely randomized.
   4.1. It contains `sets/<S>/<P>.jpg` where P is the number of inference preview step (e.g. from 1 to LAST_INFERENCE_STEP).
   4.1.1 LAST_INFERENCE_STEP depends on the action where we do the inference for. This is based on `num_inference_steps` in the AI backend.
   4.1. It contains `sets/<S>/final.jpg` which is the final generated image. This may not be needed as we can use `sets/<S>/<LAST_INFERENCE_STEP>.jpg` (i.e. the last preview step).
   4.2. We should also have `sets/<S>/meta.json` where it contains the set's metadata:
   4.2.1 `duration: {<S>: number, final: number}` indicates the time it takes to generate a particular image. `duration.final` means the time it takes between LAST_INFERENCE_STEP and final.
   4.3. If there is no `duration.final` in the metadata, assume that we can stop at LAST_INFERENCE_STEP.
5. The generation process of the images is defined as follows:
   5.1. The generation process should be able to run as headless, and NOT be ran in real-time. This is so we can rapidly generate images without waiting for the sequence queue. We should give each inference step a unique identifier, and run the generation headlessly. It could be even parallelized if we allow multiple Modal instances to spawn.
   5.2. It could use WebSocket to talk to the Modal inference endpoint and generate the image. This makes it the same as Step C.
   5.3. Alternatively, we can implement a HTTP endpoint instead for the inference a la `POST /inference/static {config}` to avoid the stateful headaches of WebSockets.
   5.2. Once each image (either preview or final) is inferenced, the inference endpoint shall save the image as well as the generation duration according to the format defined in step 4 to an object storage along with the duration metadata. Alternatively, the generation job can do this, but it adds extra network overhead.
   5.3. Each `POST /inference/static {config}` request shall generate from 1 to LAST_INFERENCE_STEP steps, which means it should generate a complete `actions/<A>/sets/<S>` directory in isolation. This operation is idempotent.

### C. Live generation based on pre-recorded transcript

This version uses Modal serverless to replicate the live-generation of images. It uses the same actions-based system as B, yet actually generates the image live without picking from a set of pre-recorded images.

When the image generation step is called, it calls the stateful WebSocket endpoint to generate the image, and sends it back to the browser to display. The logic here is in the React frontend.

### Note

We want to focus on Mode B to save compute cost and makes maintenance easier, while making sure that the experience is as seamless as Mode A and Mode C.

The goal is that there should never ever be a downtime as this is ran in an installation setting. Using an object storage like Cloudflare R2 should ensure this.

## Implementation Status

The frontend implementation is 100% complete. It works well.

The backend implementation is being ported from running in Uvicorn in a GCP compute server (which was ridiculously expensive to run and broke multiple times during the last installation), to simply being randomized from a huge set of pre-generated spaces in an object storage like R2 (which is dirt cheap).

The backend implementation is largely incomplete and not very well written to support Modal serverless. It can be better.

The LoRA implementation and the image-to-image pipeline is possibly broken as we have updated the AI model to newer versions, and I haven't tested those programs yet. Solutions include rebuilding the LoRA against the latest modal, or downgrading to the last model (which is not bad as we pre-generate statically anyway).

## Project Structure Understanding

This is an AI-powered art installation with three main components:

### Frontend (`/ui/`)

- React/TypeScript application with Vite build system
- Multiple program routes (zero.lazy.tsx, one.lazy.tsx, two.lazy.tsx, etc.) corresponding to different performance sections
- Exhibition automation system with cue-based timing and scheduling
- WebSocket integration for real-time image generation
- Audio dictation support for live speech-to-text
- Image display components with cross-fade animations

### Backend (`/api/`)

- Python FastAPI server with WebSocket support
- Modal.com integration for serverless AI hosting
- Multiple program implementations (p0.py, p2.py, p3.py) for different image generation pipelines
- LoRA model support for fine-tuned image generation
- Pipeline management utilities for different AI models

### Exhibition Scripts

- `exhibition_image_to_image.py` and `exhibition_text_to_image.py` for pre-generating image sets
- Static generation mode to avoid live inference during exhibitions

### Key Technologies

- Frontend: React, TypeScript, Vite, TanStack Router, Zustand for state management
- Backend: Python, FastAPI, Modal.com, HuggingFace, PyTorch
- Infrastructure: WebSockets, Cloudflare R2 for object storage

### How to get the latest cue for the preprocessor

1. Search for `this.cues = [...transcriptCues, ...PROGRAM_CUES]` in the codebase
2. Add that as `window.cues = ...`
3. Do `copy(JSON.stringify(window.cues))` in the console
4. Copy that in the preprocessor
