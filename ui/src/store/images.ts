import {atom} from 'nanostores'

type ImagePrompt = {id: string; prompt: string}
type ImageUrls = {id: string; url: string}

export const $imagePrompts = atom<ImagePrompt[]>([])
export const $imageUrls = atom<ImageUrls[]>([])
