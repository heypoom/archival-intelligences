import {$transcript} from '../../store/dictation'
import {$fadeStatus} from '../../store/fader'
import {$guidance, DEFAULT_GUIDANCE} from '../../store/guidance'
import {resetProgress} from '../../store/progress'
import {$generating, $prompt} from '../../store/prompt'
import {disableRegen} from '../../store/regen'

export function resetAll() {
  $prompt.set('')
  $transcript.set({transcript: '', final: false})
  $guidance.set(DEFAULT_GUIDANCE)
  $fadeStatus.set(false)
  $generating.set(false)

  resetProgress()
  disableRegen('start of show')
}
