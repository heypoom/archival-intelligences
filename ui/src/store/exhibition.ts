import {atom} from 'nanostores'
import {persistentAtom} from '@nanostores/persistent'

import {ExhibitionStatus} from '../types/exhibition-status'

// serializer
const S = {encode: JSON.stringify, decode: JSON.parse}

export const $exhibitionMode = persistentAtom<boolean>(
  'exhibitionMode',
  false,
  S
)

export const $exhibitionStatus = atom<ExhibitionStatus>({type: 'loading'})
export const $videoMode = atom(false)
export const $offlineMode = atom(false)

// assume autoplay policy is enabled by default
export const $canPlay = atom(true)
export const $muted = atom(false)

export const $disconnected = atom(false)
