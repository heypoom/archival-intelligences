import {atom} from 'nanostores'

export const $prompt = atom('')
export const $generating = atom(false)
export const $inferencePreview = atom('')

export const $apiReady = atom(false)
