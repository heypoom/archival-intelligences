import {atom, map} from 'nanostores'

/**
 * As we asynchronously and continuously process the audio stream,
 * we do not need to stop the recognition process.
 */
export type DictationState = 'stopped' | 'starting' | 'listening' | 'failed'

export type Transcript = {
  id?: string
  transcript: string
  final?: boolean
}

export const $dictationState = atom<DictationState>('stopped')

export const $latestTranscript = map<Transcript>({
  transcript: '',
})

export const $transcripts = map<Transcript[]>([])
