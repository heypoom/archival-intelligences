import {GladiaWord} from '../types/gladia-transcript'

export const PROGRAM_ZERO_START_TIME = '00:06:47'
export const PROGRAM_ZERO_END_TIME = '00:34:25'
export const SCREENING_END_TIME = '01:14:00'

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
  | {action: 'cleanup-before-end'} // clean up the program
  | {action: 'end'} // end the showing

export type AutomationCue = AutomationAction & {time: string}

// Must be sorted by time with the transcription cues before use.
export const PROGRAM_CUES: AutomationCue[] = [
  // we start at 00:00:00
  {time: '00:00:00', action: 'start'},

  // fade in program zero
  {time: '00:06:45', action: 'navigate', route: '/zero'},
  {time: PROGRAM_ZERO_START_TIME, action: 'set-fade-status', fade: false},

  // fade to black, prepare to go to program 1
  {time: PROGRAM_ZERO_END_TIME, action: 'next'},

  // start program 1
  {time: '00:36:05', action: 'next'},

  // start program 2
  {time: '00:44:12', action: 'navigate', route: '/two'},

  // type prompt
  {
    time: '00:44:22',
    action: 'prompt',
    program: 'P2',
    prompt: 'painting like epic poem of malaya',
    commit: true,
    guidance: 40,
  },

  // slide to 0%
  {time: '00:44:51', action: 'move-slider', value: 0, program: 'P2'},

  // slide to 70%
  {time: '00:45:23', action: 'move-slider', value: 70, program: 'P2'},

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
  {time: '00:46:00', action: 'navigate', route: '/three-b'},

  // erase prompt
  {
    time: '00:46:02',
    action: 'prompt',
    prompt: '',
    delay: {base: 30, variance: 20},
    commit: false,
    program: 'P3B',
  },

  // type prompt
  {
    time: '00:46:06',
    action: 'prompt',
    program: 'P3B',
    prompt: 'chua mia tee painting',
    enter: {regen: true},
  },

  // start program 4
  {time: '00:54:23', action: 'navigate', route: '/four'},

  // type prompt
  {
    time: '00:54:28',
    action: 'prompt',
    program: 'P4',
    prompt: 'data researcher',
    override: 'person, data researcher, photorealistic',
    enter: {regen: false},
  },

  // type prompt
  {
    time: '00:54:57',
    action: 'prompt',
    program: 'P4',
    prompt: 'crowdworker',
    enter: {regen: false},
  },

  // start program 4B
  {time: '00:55:41', action: 'navigate', route: '/four-b'},

  // type prompt
  {
    time: '00:55:46',
    action: 'prompt',
    program: 'P4',
    prompt: 'big tech ceo',
    enter: {regen: true},
  },

  // type prompt
  {
    time: '01:10:15',
    action: 'prompt',
    program: 'P4',
    prompt: 'stable diffusion',
    enter: {regen: true},
  },

  // fade to black
  {
    time: '01:12:09',
    action: 'set-fade-status',
    fade: true,
  },

  // cleanup before the screening ends
  {
    time: '01:12:11',
    action: 'cleanup-before-end',
  },

  {
    time: SCREENING_END_TIME,
    action: 'end',
  },
]
