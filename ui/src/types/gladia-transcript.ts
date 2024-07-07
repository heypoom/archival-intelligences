export interface GladiaTranscript {
  transcription: {
    full_transcript: string
    languages: string[]
    utterances: GladiaUtterance[]
  }

  metadata: {
    audio_duration: number
    billing_time: number
    number_of_distinct_channels: number
    transcription_time: number
  }
}

export interface GladiaUtterance {
  text: string
  start: number
  end: number
  confidence: number
  language: string
  channel: number
  words: GladiaWord[]
}

export interface GladiaWord {
  word: string
  start: number
  end: number
  confidence: number
}
