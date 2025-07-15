# Regenerate Images for Program B

We have to generate "virtual cues" to emulate "Program B" behavior where it keeps re-generating until we proceed to the next cue, with a little delay added in between the generation iterations (see `$regenCount`):

- P2B
- P3B
  - prompt: `chua mia tee painting`
- P4 with `regen: true` (emulates P4B)

  - prompt: "big tech ceo"
  - prompt: "stable diffusion"
  - see `ui/src/constants/exhibition-cues.ts`

- See `ui/src/store/regen.ts` for how the regeneration worked before when it was in live-generation mode.
  - It was called by `ui/src/utils/inference.ts` (startInference)

For this offline-mode implementation, we have to schedule those cues.

Previously, the format for other programs are: `https://images.poom.dev/foigoi/${PREGEN_VERSION_ID}/cues/${cueId}/${variant}/${fileName}`

where:

- PREGEN_VERSION_ID is the pre-generation version ID, right now it is `1`
- cueId is the cue ID, e.g. `prompt_400_01_12_50`
- variant is the variant ID, e.g. `1`
- fileName is the file name, e.g. `final.png` or `1.png` for the first inference step preview.

In this implementation, we can leverage the variant system to simply use the same cue ID and re-randomize the variant ID for each regeneration step, which should already be done automatically. Once the inference step preview simulation is done for a variant id, we simply need to delay for a little bit (see `ui/src/store/regen.ts` for the delay logic), then do the generation again. Once the timing hits for the next cue, we stop the regeneration and proceed to the next cue.

The tricky part is that we need to be able to abort the in-process generation, if the time for the next cue has come. e.g. if we are still generating 'big tech ceo' but the next cue is 'stable diffusion', we need to stop the current generation and proceed to the next one.

Reminder that no network requests should be made in this offline mode.
