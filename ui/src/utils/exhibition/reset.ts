import {$transcript} from '../../store/dictation'
import {$guidance, DEFAULT_GUIDANCE} from '../../store/guidance'
import {resetProgress} from '../../store/progress'
import {$generating, $inferencePreview, $prompt} from '../../store/prompt'
import {$regenCount, disableRegen} from '../../store/regen'
import {$programTimestamp, $videoTimestamp} from '../../store/timestamps'

export function resetAll() {
  $prompt.set('')
  $transcript.set({transcript: '', final: false})
  $inferencePreview.set('')
  $guidance.set(DEFAULT_GUIDANCE)
  $generating.set(false)
  $regenCount.set(0)
  $videoTimestamp.set(0)
  $programTimestamp.set(0)

  resetProgress()
  disableRegen('start of show')
}
