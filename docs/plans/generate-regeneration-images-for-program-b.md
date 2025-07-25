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

## Implementation Plan (Updated)

### Overview

Implement offline continuous re-generation for Program B routes (P2B, P3B, P4B) that mimics the live system's behavior where images keep regenerating until the next cue is reached.

### Analysis of Current System

#### Current Regeneration Logic

- **Base delay**: 30 seconds initial wait
- **Incremental delay**: +30 seconds for each generation after the 6th
- **Triggers**: Cues with `enter: {regen: true}` property
- **Affected programs**: P3B (`chua mia tee painting`), P4 (`big tech ceo`, `stable diffusion`)

#### Image Path Structure

Already implemented: `https://images.poom.dev/foigoi/${PREGEN_VERSION_ID}/cues/${cueId}/${variant}/${fileName}`

- Re-randomize `variant` for each regeneration cycle
- Use same `cueId` for consistent prompt/cue mapping

### Implementation Tasks

#### 1. Create Offline Regeneration Functions

**File**: `ui/src/utils/exhibition/offline-automation-replay.ts` (extend existing file)

- `startOfflineRegeneration()` function to handle continuous regeneration
- `abortOfflineRegeneration()` function to stop ongoing regeneration
- Track active regeneration with simple timer variable
- Generate new variant IDs for each cycle

#### 2. Extend Offline Action Handler

**File**: `ui/src/utils/exhibition/run-offline-automation-action.ts`

- Detect `enter: {regen: true}` in prompt actions
- Start offline regeneration instead of single inference
- Stop previous regeneration when new cue starts

#### 3. Update Regeneration Store for Offline Mode

**File**: `ui/src/store/regen.ts`

- Add offline mode detection
- Bypass socket.generate() calls in offline mode
- Maintain $regenCount state for UI consistency

#### 4. Enhance Image Path Generation

**File**: `ui/src/utils/exhibition/offline-automation-replay.ts`

- Add regeneration-specific image path generation
- Support explicit variant override for regeneration cycles

### Technical Details

#### Regeneration Cycle Logic

1. **Initial Generation**: Standard step-by-step inference with random variant
2. **Delay Calculation**: 30s base + (count-6)\*30s incremental after 6th generation
3. **Next Cycle**: New random variant, repeat step-by-step inference
4. **Abort Condition**: Stop when `automator.currentCue` changes or next action arrives

#### State Management

- Reuse existing `$regenCount`, `$regenActive`, `$regenEnabled` atoms
- Add `$offlineRegeneration` atom for offline-specific state
- Integrate with existing `$generating` and `$inferencePreview` states

#### Cue Detection

Target cues with `enter: {regen: true}`:

- P3B: `chua mia tee painting` (00:46:06)
- P4: `big tech ceo` (00:55:46)
- P4: `stable diffusion` (01:10:20)

#### Abort Mechanism

- Monitor `automator.currentCue` changes
- Clear regeneration timers when new cue starts
- Graceful cleanup of ongoing inference simulation

### Benefits

- ✅ **Authentic Experience**: Matches live system's continuous regeneration behavior
- ✅ **Performance**: No network requests, uses pre-generated variants
- ✅ **Flexibility**: Works with debug time slider and seeking
- ✅ **Maintainability**: Reuses existing regeneration state management
- ✅ **Robustness**: Proper cleanup and abort handling for timeline navigation
