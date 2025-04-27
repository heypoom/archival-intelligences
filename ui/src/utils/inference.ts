import {ProgramId, socket} from '../manager/socket'
import {$apiReady, $generating, $prompt} from '../store/prompt'
import {regen} from '../store/regen'

interface Options {
  prompt?: string
  command: ProgramId
  regenerate?: boolean | string
}

export function startInference(options: Options) {
  const {prompt = $prompt.get(), command, regenerate} = options

  const apiReady = $apiReady.get()

  if (!apiReady) {
    console.log('[!!!!] socket not ready')
    return
  }

  $generating.set(true)

  socket.generate(command, prompt)

  const shouldRegenerate =
    regenerate === true ||
    (typeof regenerate === 'string' &&
      prompt.endsWith(regenerate.toLowerCase()))

  if (shouldRegenerate) {
    regen(command, prompt)
  }
}
