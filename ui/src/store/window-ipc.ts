import {atom} from 'nanostores'

// Program is the primary window mode, while video is the secondary window mode.
// Video goes on the left screen, while program goes on the right screen.
export type IpcMode = 'program' | 'video'

export type IpcAction =
  | {type: 'ping'}
  | {type: 'pong'; mode: IpcMode; elapsed: number}
  | {type: 'play'; elapsed: number}

export type IpcMessage = IpcAction & IpcMeta

export interface IpcMeta {
  ipcId: string
  dynamicMockedTime: string | null
}

export const $ipcMode = atom<IpcMode>('program')
