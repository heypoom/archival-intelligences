import {atom} from 'nanostores'
import {socket} from '../manager/socket'
import {$generating} from './prompt'
import {$progress} from './progress'

let regenerateTimer = 0

const BASE_DELAY = 30 * 1000
const INCREMENTAL_DELAY = BASE_DELAY
const BASE_GENERATION = 6

/** Used in P3B and P4B to keep track of current generation count. */
export const $regenCount = atom(0)
export const $regenEnabled = atom(false)
export const $regenActive = atom(false)

export function regen(command: string, prompt: string, origin = true) {
  if (origin) {
    $regenEnabled.set(true)
    $regenActive.set(true)

    console.log('[gen] regen active')
  }

  const gen = $regenCount.get()

  let delay = BASE_DELAY

  if (gen > BASE_GENERATION) {
    delay += (gen - BASE_GENERATION) * INCREMENTAL_DELAY
  }

  console.log(`[gen] regen "${prompt}" in ${delay}ms (i=${gen})`)

  regenerateTimer = setTimeout(() => {
    const progress = $progress.get()

    if (progress > 0 && progress < 98) {
      console.log(
        `[gen] progress at ${progress}% is not complete yet, we wait.`
      )
    } else {
      socket.sock.send(`${command}:${prompt}`)
      $generating.set(false)

      const gen = $regenCount.get()
      console.log(`[gen] regen "${prompt}" now! (i=${gen}, delay=${delay}ms)`)
      $regenCount.set(gen + 1)
    }

    setTimeout(() => {
      regen(command, prompt, false)
    }, 5)
  }, delay)
}

export function disableRegen(reason?: string) {
  const regen = $regenActive.get()
  if (!regen) return

  console.log(`[gen] disable regen (reason=${reason})`)

  $regenCount.set(0)
  $regenActive.set(false)
  clearTimeout(regenerateTimer)

  socket.reconnectSoon(reason, 10, {shutup: true})
}
