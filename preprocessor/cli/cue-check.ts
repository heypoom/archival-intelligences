import _cues from '../data/cues.json'

import type {AutomationCue} from '../src/types'

const cues = _cues as AutomationCue[]

const transcriptCuesToGenerate = cues.filter(
  (cue) => cue.action === 'transcript' && cue.generate
)

const imageGenerationCuesToGenerate = cues.filter(
  (cue) => cue.action === 'prompt'
)

const moveSliderCuesToGenerate = cues.filter(
  (cue) => cue.action === 'move-slider'
)

console.log('transcript cues to generate:', transcriptCuesToGenerate.length)
console.log('image generation cues:', imageGenerationCuesToGenerate.length)
console.log('move slider cues:', moveSliderCuesToGenerate.length)
