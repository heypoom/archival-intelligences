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
      program: ProgramId
      enter?: {regen: boolean}
      commit?: boolean
      guidance?: number
    } // clear, type, and enter prompt
  | {action: 'move-slider'; program: string; value: number} // slowly move the guidance slider
  | {action: 'reconnect'} // disable regen and reconnect
  | {action: 'end'} // end the showing

export type AutomationCue = AutomationAction & {time: string}