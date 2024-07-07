import {atom} from 'nanostores'
import {ExhibitionStatus} from '../types/exhibition-status'

export const $exhibitionMode = atom(true)
export const $exhibitionStatus = atom<ExhibitionStatus>({type: 'loading'})
