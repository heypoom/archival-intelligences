# Stable Diffusion Live Feed

The live feed takes **live voice input** from the microphone, runs it through speech recognition,
runs it through a LLM to summarize and transform into image prompts, then gradually morphs the image
into the subject being discussed on.

## Structure

- `ui/`: frontend, written in React and Vite.
- `api/`: backend, written in fastapi and Python for inference.

