import {GladiaWord} from '../types/gladia-transcript'

export const PROGRAM_ZERO_START_TIME = '00:06:52'
export const PROGRAM_ZERO_END_TIME = '00:32:26'
export const SCREENING_END_TIME = '01:12:30'

export type AutomationAction =
  | {action: 'start'} // start the program
  | {action: 'next'} // go to the next program
  | {
      action: 'transcript'
      transcript: string

      when?: [number, number]
      words?: GladiaWord[]
      generate?: boolean
    } // add transcript
  | {action: 'set-fade-status'; fade: boolean} // set the fade-to-black status
  | {action: 'navigate'; route: string} // navigate to a route
  | {
      action: 'prompt'
      prompt: string
      override?: string
      delay?: {base?: number; variance?: number}
      program: string
      enter?: {regen: boolean}
      commit?: boolean
      guidance?: number
    } // clear, type, and enter prompt
  | {action: 'move-slider'; program: string; value: number} // slowly move the guidance slider
  | {action: 'end'} // end the showing

export type AutomationCue = AutomationAction & {time: string}

// Must be sorted by time with the transcription cues before use.
export const PROGRAM_CUES: AutomationCue[] = [
  // we start at 00:00:00
  {time: '00:00:00', action: 'start'},

  // fade in program zero
  {time: '00:06:49', action: 'navigate', route: '/zero'},
  {time: PROGRAM_ZERO_START_TIME, action: 'set-fade-status', fade: false},

  // fade to black, prepare to go to program 1
  {time: PROGRAM_ZERO_END_TIME, action: 'next'},

  // start program 1
  {time: '00:34:06', action: 'next'},

  // start program 2
  {time: '00:42:10', action: 'navigate', route: '/two'},

  // type prompt
  {
    time: '00:42:18',
    action: 'prompt',
    program: 'P2',
    prompt: 'painting like epic poem of malaya',
    commit: true,
    guidance: 40,
  },

  // slide to 0%
  {time: '00:42:48', action: 'move-slider', value: 0, program: 'P2'},

  // slide to 70%
  {time: '00:43:15', action: 'move-slider', value: 70, program: 'P2'},

  // start program 2B
  // {time: '00:43:30', action: 'navigate', route: '/two-b'},

  // type prompt
  // {
  //   time: '00:43:35',
  //   action: 'prompt',
  //   program: 'P2B',
  //   prompt: 'painting like epic poem of malaya but with more people',
  //   guidance: 60,
  // },

  // start program 3B
  {time: '00:43:54', action: 'navigate', route: '/three-b'},

  // erase prompt
  {
    time: '00:43:58',
    action: 'prompt',
    prompt: '',
    delay: {base: 30, variance: 20},
    commit: false,
    program: 'P3B',
  },

  // type prompt
  {
    time: '00:44:00',
    action: 'prompt',
    program: 'P3B',
    prompt: 'chua mia tee painting',
    enter: {regen: true},
  },

  // start program 4
  {time: '00:52:40', action: 'navigate', route: '/four'},

  // type prompt
  {
    time: '00:52:45',
    action: 'prompt',
    program: 'P4',
    prompt: 'data researcher',
    override: 'person, data researcher, photorealistic',
    enter: {regen: false},
  },

  // type prompt
  {
    time: '00:53:15',
    action: 'prompt',
    program: 'P4',
    prompt: 'crowdworker',
    enter: {regen: false},
  },

  // start program 4B
  {time: '00:53:45', action: 'navigate', route: '/four-b'},

  // type prompt
  {
    time: '00:53:50',
    action: 'prompt',
    program: 'P4',
    prompt: 'big tech ceo',
    enter: {regen: true},
  },

  // type prompt
  {
    time: '01:08:48',
    action: 'prompt',
    program: 'P4',
    prompt: 'stable diffusion',
    enter: {regen: true},
  },

  // fade to black
  {
    time: '01:10:54',
    action: 'set-fade-status',
    fade: true,
  },

  {
    time: SCREENING_END_TIME,
    action: 'end',
  },
]
