import {socket} from '../manager/socket'
import {$imageFadingOut} from '../store/fader'
import {$apiReady, $generating, $inferencePreview} from '../store/prompt'
import {disableRegen} from '../store/regen'

const FADE_OUT_DURATION = 2000

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function fadeOutOldImage() {
  $imageFadingOut.set(true)

  // wait for the old image to fully fade out
  await delay(FADE_OUT_DURATION)

  $imageFadingOut.set(false)
  $inferencePreview.set('')
}

interface PromptKeyChangeOptions {
  input: string
  command: string
  guidance?: number
}

export async function onPromptKeyChangeStart() {
  // reset generation count if we're regenerating
  disableRegen('prompt change')

  await fadeImageIfExist()
}

async function fadeImageIfExist() {
  const previewUrl = $inferencePreview.get()

  if (previewUrl) {
    await fadeOutOldImage()
  }
}

export async function onPromptCommitted(options: PromptKeyChangeOptions) {
  const {input, command, guidance = 0} = options

  const apiReady = $apiReady.get()

  if (!apiReady) {
    console.log('[!!!!] socket not ready')
    return
  }

  console.log(`generating "${input}" with guidance ${guidance} -> ${command}`)
  $generating.set(true)

  console.log(`[program] c=${command}, g=${guidance}`)

  if (command === 'P2') {
    socket.sock.send(`P2:${(guidance / 100).toFixed(2)}`)
  } else if (command === 'P2B') {
    socket.sock.send(`P2B:${(guidance / 100).toFixed(2)}`)
  } else if (command === 'P3B') {
    socket.sock.send(`P3B:${input}`)
  } else {
    socket.sock.send(command)
  }
}

interface GuidanceChangeOptions {
  command: string
  value: number
}

export async function onGuidanceCommitted(options: GuidanceChangeOptions) {
  const {command, value} = options

  await fadeImageIfExist()

  $generating.set(true)

  if (command === 'P2') {
    socket.sock.send(`P2:${(value / 100).toFixed(2)}`)
  } else if (command === 'P2B') {
    socket.sock.send(`P2B:${(value / 100).toFixed(2)}`)
  }
}
