# Offline Automation Replay Mode

Right now, the exhibition automation system are defined in these files:

- `ui/src/utils/exhibition/exhibition-automator.ts` stores the cue logic.
- `ui/src/utils/exhibition/run-automation-action.ts` stores how to actually dispatch.

The live-generation system relies on running the generation in real-time, e.g. `socket.emit`, `startInference` (`ui/src/utils/inference.ts`), `onPromptCommitted` (`ui/src/utils/prompt-manager.ts`)

However, the offline automation replay mode does not need to run in real-time. Instead, it can just read the images from a file.

Look at `ui/src/routes/image-viewer.lazy.tsx` on how the images are retrieved. You will see multiple kind of files: final image file, preview step image file, and different variants of the same prompt.

You should look at the type of files we have, the type of automation steps we have (most importantly `prompt`, `transcript`, `move-slider`), then implement a separate file `ui/src/utils/exhibition/offline-automation-replay.ts` that will read the files and replay the automation steps. You must make sure to not use any `socket` methods or methods that rely on real-time generation, and keep it 100% offline.

The exhibition automator should be aware of the offline mode (using the `$offlineMode` atom in `ui/src/store/exhibition.ts`), and trigger the offline automation replay when the mode is enabled.

## Detailed Implementation Plan

### Architecture Overview

Based on analysis of the current system, the offline automation replay system will read pre-generated images from files instead of relying on real-time generation.

### Key Implementation Steps

#### 1. Create `ui/src/utils/exhibition/offline-automation-replay.ts`

This will be the core offline replay system with these responsibilities:

- Replace real-time generation with file-based image loading
- Handle all automation actions that generate images (`prompt`, `transcript`, `move-slider`)
- Use the same image path generation logic as `image-viewer.lazy.tsx`
- Maintain timing and sequencing without socket dependencies

#### 2. Modify `ui/src/utils/exhibition/exhibition-automator.ts`

Add offline mode detection and routing:

- Check `$offlineMode` atom before running actions
- Route image-generating actions to offline replay system
- Keep all other automation actions (navigation, fade, etc.) unchanged

#### 3. Create Offline Action Handler `ui/src/utils/exhibition/run-offline-automation-action.ts`

Mirror the structure of `run-automation-action.ts` but for offline mode:

- Handle `prompt` actions by loading pre-generated images
- Handle `transcript` actions by loading transcript-based images
- Handle `move-slider` actions with proper timing
- Skip all socket-dependent operations (`startInference`, `onPromptCommitted`)

#### 4. Implement Image Loading and Display Logic

Reuse patterns from `image-viewer.lazy.tsx`:

- Generate image URLs using the same logic: `https://images.poom.dev/foigoi/{version}/cues/{cueId}/{variant}/final.png`
- Handle both prompt and transcript cue types
- Fully randomize the variant number in each cue/action. No two run should have the same variant number.
- If an image is missing, show a black background image instead.

#### 5. State Management Integration

Update image display stores:

- Populate `$inferencePreview` or relevant image stores with loaded images
- Maintain proper timing for image transitions
- Ensure fade effects and transitions work identically to live mode

### Technical Details

#### File Path Generation

```typescript
const generateImagePath = (cue: AutomationCue, variant: number = 1) => {
  const allCueIndex = automator.cues.indexOf(cue)
  const cueSuffix = `${allCueIndex}_${cue.time.replace(/[:.]/g, '_')}`

  let cueId: string
  if (cue.action === 'transcript') {
    cueId = `transcript_${cueSuffix}`
  } else if (cue.action === 'prompt') {
    cueId = `prompt_${cueSuffix}`
  }

  return `https://images.poom.dev/foigoi/1/cues/${cueId}/${variant}/final.png`
}
```

#### Action Filtering

Only handle actions that require real-time generation:

- `prompt` actions with `commit !== false` and supported programs (exclude P2*/P3*)
- `transcript` actions with `generate: true`
- `move-slider` actions (guidance changes may trigger generation)

#### Integration Points

- `ExhibitionAutomator.go()` - Check `$offlineMode` before calling `runAutomationAction`
- `runAutomationAction()` - Route to offline handler when in offline mode
- Image stores - Populate with loaded image URLs instead of live-generated content

### Benefits

1. **No Backend Dependency**: Runs completely offline using pre-generated images
2. **Identical Timing**: Maintains exact same cue timing and sequencing
3. **Easy Toggle**: Simple `$offlineMode` atom controls behavior

This implementation will allow the exhibition to run without the Python backend while maintaining all visual and timing characteristics of the live system.
