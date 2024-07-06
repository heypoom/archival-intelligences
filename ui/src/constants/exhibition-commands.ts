export type AutomationAction =
  | {action: 'start'} // start the program
  | {action: 'next'} // go to the next program
  | {action: 'set-fade-status'; fade: boolean} // set the fade-to-black status
  | {action: 'navigate'; route: string} // navigate to a route
  | {action: 'prompt'; prompt: string} // clear, type, and enter prompt
  | {action: 'move-slider'; value: number} // slowly move the guidance slider
  | {action: 'end'} // end the showing

export type AutomationSequence = AutomationAction & {time: string}

export const PART_TWO_SEQUENCES: AutomationSequence[] = [
  // part two remains at program 0
  {time: '00:01:00', action: 'navigate', route: '/'},

  // fade to black
  {time: '00:02:00', action: 'next'},

  // start program 1
  {time: '00:00:00', action: 'next'},

  // start program 2
  {time: '00:00:00', action: 'next'},

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'painting like epic poem of malaya',
  },

  // slide to 0%
  {time: '00:00:00', action: 'move-slider', value: 0},

  // slide to 70%
  {time: '00:00:00', action: 'move-slider', value: 70},

  // start program 2B
  {time: '00:00:00', action: 'navigate', route: '/two-b'},

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'painting like epic poem of malaya but with more people',
  },

  // start program 3B
  {time: '00:00:00', action: 'navigate', route: '/three-b'},

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'chua mia tee painting',
  },

  // start program 4
  {time: '00:00:00', action: 'navigate', route: '/four'},

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'data researcher',
  },

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'crowdworker',
  },

  // start program 4B
  {time: '00:00:00', action: 'navigate', route: '/four-b'},

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'big tech ceo',
  },

  // type prompt
  {
    time: '00:00:00',
    action: 'prompt',
    prompt: 'stable diffusion',
  },

  // fade to black
  {
    time: '00:00:00',
    action: 'set-fade-status',
    fade: true,
  },

  {
    time: '00:00:00',
    action: 'end',
  },
]

export function getAutomationSequences(): AutomationSequence[] {
  return PART_TWO_SEQUENCES
}
