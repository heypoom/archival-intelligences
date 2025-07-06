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
