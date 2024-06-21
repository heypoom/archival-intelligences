import {atom} from 'nanostores'
import {socket} from '../manager/socket'
import {$generating} from './prompt'

let regenerateTimer = 0

const BASE_DELAY = 30 * 1000
const INCREMENTAL_DELAY = BASE_DELAY
const BASE_GENERATION = 6

/** Used in P3B and P4B to keep track of current generation count. */
export const $regenCount = atom(0)
export const $regenEnabled = atom(false)
export const $regenActive = atom(false)

export function regenerate(command: string, prompt: string, origin: boolean) {
  if (origin) {
    $regenEnabled.set(true)
    $regenActive.set(true)
  }

  const gen = $regenCount.get()

  if (!origin && gen < 1) {
    console.warn(`[gen] invariant! not origin but gen is still ${gen}`)
  }

  let delay = BASE_DELAY

  if (gen > BASE_GENERATION) {
    delay += (gen - BASE_GENERATION) * INCREMENTAL_DELAY
  }

  console.log(`[gen] regen "${prompt}" in ${delay}ms (i=${gen})`)

  regenerateTimer = setTimeout(() => {
    $generating.set(false)

    const gen = $regenCount.get()
    socket.sock.send(`${command}:${prompt}`)

    console.log(`[gen] regen "${prompt}" now! (i=${gen}, delay=${delay}ms)`)

    $regenCount.set(gen + 1)

    setTimeout(() => {
      regenerate(command, prompt, false)
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
