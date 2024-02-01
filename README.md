# Stable Diffusion From Speech

This program takes **live speech input** from the microphone, runs it through speech recognition,
passes it through a LLM to summarize and transform into image prompts, then gradually morphs the image into the subject being discussed on. The result would be a continuously-morphing videos reflecting the topics being discussed about.

## Structure

- `ui/`: frontend, written in React and Vite.
- `api/`: backend, written in fastapi and Python for inference.
