import {$transcript} from '../../store/dictation'
import {$guidance, DEFAULT_GUIDANCE} from '../../store/guidance'
import {resetProgress} from '../../store/progress'
import {$generating, $prompt} from '../../store/prompt'
import {$regenCount, disableRegen} from '../../store/regen'

export function resetAll() {
  $prompt.set('')
  $transcript.set({transcript: '', final: false})
  $guidance.set(DEFAULT_GUIDANCE)
  $generating.set(false)
  $regenCount.set(0)

  resetProgress()
  disableRegen('start of show')
}
