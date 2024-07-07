import {GladiaWord} from '../types/gladia-transcript'

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
    } // clear, type, and enter prompt
  | {action: 'move-slider'; program: string; value: number} // slowly move the guidance slider
  | {action: 'end'} // end the showing

export type AutomationCue = AutomationAction & {time: string}

export const PART_TWO_CUES: AutomationCue[] = [
  // fade to black
  {time: '02:30:00', action: 'next'},

  // start program 1
  {time: '02:03:00', action: 'next'},

  // start program 2
  {time: '02:04:00', action: 'next'},

  // type prompt
  {
    time: '02:06:00',
    action: 'prompt',
    program: 'P2',
    prompt: 'painting like epic poem of malaya',
    commit: false,
  },

  // slide to 0%
  {time: '02:05:00', action: 'move-slider', value: 0, program: 'P2'},

  // slide to 70%
  {time: '02:07:00', action: 'move-slider', value: 70, program: 'P2'},

  // start program 2B
  {time: '02:08:00', action: 'navigate', route: '/two-b'},

  // type prompt
  {
    time: '02:09:00',
    action: 'prompt',
    program: 'P2B',
    prompt: 'painting like epic poem of malaya but with more people',
  },

  // start program 3B
  {time: '02:10:00', action: 'navigate', route: '/three-b'},

  // erase prompt
  {
    time: '02:10:30',
    action: 'prompt',
    prompt: '',
    delay: {base: 30, variance: 20},
    commit: false,
    program: 'P3B',
  },

  // type prompt
  {
    time: '02:11:00',
    action: 'prompt',
    program: 'P3B',
    prompt: 'chua mia tee painting',
    enter: {regen: true},
  },

  // start program 4
  {time: '02:12:00', action: 'navigate', route: '/four'},

  // type prompt
  {
    time: '02:13:00',
    action: 'prompt',
    program: 'P4',
    prompt: 'data researcher',
    override: 'person, data researcher, photorealistic',
    enter: {regen: false},
  },

  // type prompt
  {
    time: '02:14:00',
    action: 'prompt',
    program: 'P4',
    prompt: 'crowdworker',
    enter: {regen: false},
  },

  // start program 4B
  {time: '02:15:00', action: 'navigate', route: '/four-b'},

  // type prompt
  {
    time: '02:16:00',
    action: 'prompt',
    program: 'P4',
    prompt: 'big tech ceo',
    enter: {regen: true},
  },

  // type prompt
  {
    time: '02:17:00',
    action: 'prompt',
    program: 'P4',
    prompt: 'stable diffusion',
    enter: {regen: true},
  },

  // fade to black
  {
    time: '02:18:00',
    action: 'set-fade-status',
    fade: true,
  },

  {
    time: '02:19:00',
    action: 'end',
  },
]
