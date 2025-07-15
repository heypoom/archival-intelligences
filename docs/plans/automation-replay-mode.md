# Offline Automation Replay Mode

Right now, the exhibition automation system are defined in these files:

- `ui/src/utils/exhibition/exhibition-automator.ts` stores the cue logic.
- `ui/src/utils/exhibition/run-automation-action.ts` stores how to actually dispatch.

The live-generation system relies on running the generation in real-time, e.g. `socket.emit`, `startInference` (`ui/src/utils/inference.ts`), `onPromptCommitted` (`ui/src/utils/prompt-manager.ts`)

However, the offline automation replay mode does not need to run in real-time. Instead, it can just read the images from a file.

Look at `ui/src/routes/image-viewer.lazy.tsx` on how the images are retrieved. You will see multiple kind of files: final image file, preview step image file, and different variants of the same prompt.

You should look at the type of files we have, the type of automation steps we have (most importantly `prompt`, `transcript`, `move-slider`), then implement a separate file `ui/src/utils/exhibition/offline-automation-replay.ts` that will read the files and replay the automation steps. You must make sure to not use any `socket` methods or methods that rely on real-time generation, and keep it 100% offline.

The exhibition automator should be aware of the offline mode (using the `$offlineMode` atom in `ui/src/store/exhibition.ts`), and trigger the offline automation replay when the mode is enabled.
