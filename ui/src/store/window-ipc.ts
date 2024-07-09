import {atom} from 'nanostores'
import {ExhibitionStatus} from '../types/exhibition-status'

// Program is the primary window mode, while video is the secondary window mode.
// Video goes on the left screen, while program goes on the right screen.
export type IpcMode = 'program' | 'video'

export type IpcMessage =
  | {type: 'ping'; id: string}
  | {
      type: 'pong'
      id: string
      mode: IpcMode
      elapsed: number
      status: ExhibitionStatus
    }
  | {type: 'play'; elapsed: number; status: ExhibitionStatus}

export const $ipcMode = atom<IpcMode>('program')
