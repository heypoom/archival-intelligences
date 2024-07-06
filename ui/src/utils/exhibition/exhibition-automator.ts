import {getExhibitionStatus} from './get-exhibition-status'

export class ExhibitionAutomator {
  sessionStart = '00:00'
  getCurrentTime = (): Date => new Date()

  start() {
    const now = this.getCurrentTime()
    const status = getExhibitionStatus(now)

    console.log(now)
    console.log(status)

    if (status.type === 'active') {
      this.sessionStart = status.start
    }
  }
}

export const exhibitionAutomator = new ExhibitionAutomator()
