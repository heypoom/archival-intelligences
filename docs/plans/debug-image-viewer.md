# Debug Image Viewer for Image Generation Cues

Build a debug image viewer route into the frontend, where I can view the images and its metadata from the image generation cues. This React route is /image-viewer.

## Requirements

- Parse the transcript cues into transcript paths first.

  - Frontend already has the cues.json parsed.
  - See how the image paths can be derived in generate.ts.
  - Example of path format: `transcript_375_01_12_50/1/final.png`, where 375 is the cue number and 01:12:50 is the timecode. 1 is the variation id.
  - The images are stored on <https://images.poom.dev/foigoi/PATH> where path is described above.
  - Example: `https://images.poom.dev/foigoi/transcript_375_01_12_50/1/final.png`

- Make an image viewer that lets you view these images quickly.

  - Left/Right arrow: move across transcript folder (~100ish).
  - Up/Down arrow: move across variations of the same cue (1 - 10).
  - Any images could be missing. You must show a "missing image" if any image failed to load. Do not crash the viewer.

- Show the timecode, program key (fow now all of them is P0 since we should load just the transcript cue first), text prompt and variation id (1 - 10) for each image on screen.

  - Show the keybinds guide too.

- Heads-up: The cue image viewer must support other 2 cue types in the next version, for the prompt and move_slider cue actions.
  - The other programs contains inference step preview images, where you may have `/foigoi/prompt_400_01_12_50/1/3.png` which means the preview image is at the inference step 3, hence the "3.png".
