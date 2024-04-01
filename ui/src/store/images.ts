import { atom } from 'nanostores'

export type ImagePrompt = { id: string; prompt: string }
export type ImageUrls = { id: string; url: string }

export const $imagePrompts = atom<ImagePrompt[]>([])
export const $imageUrls = atom<ImageUrls[]>([])
