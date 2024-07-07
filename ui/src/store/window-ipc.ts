import {atom} from 'nanostores'

// Program is the primary window mode, while video is the secondary window mode.
// Video goes on the left screen, while program goes on the right screen.
export type IpcMode = 'program' | 'video'

export type IpcMessage =
  | {type: 'ping'; id: string}
  | {type: 'pong'; id: string; mode: IpcMode; elapsed: number}
  | {type: 'play'; elapsed: number}

export const $ipcMode = atom<IpcMode>('program')
