import {test} from 'vitest'

import {timeOf} from './timecode'
import {ExhibitionAutomator} from './exhibition-automator'

test('exhibition automator', () => {
  const automator = new ExhibitionAutomator()

  const clock = (time: string) => {
    automator.now = () => timeOf(time)
  }

  clock('14:00')
})
