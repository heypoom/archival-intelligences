import {expect, test} from 'vitest'
import {getCurrentCue} from './get-current-cue'
import {AutomationCue} from '../../constants/exhibition-cues'

export const DEMO_SEQ: AutomationCue[] = [
  {time: '00:01:00', action: 'prompt', prompt: 'b', program: 'P0'},
  {time: '00:02:00', action: 'next'},
  {time: '00:03:00', action: 'end'},
]

const cases: [string, AutomationCue | undefined][] = [
  ['00:00:59', undefined],
  [
    '00:01:00',
    {time: '00:01:00', action: 'prompt', prompt: 'b', program: 'P0'},
  ],
  [
    '00:01:59',
    {time: '00:01:00', action: 'prompt', prompt: 'b', program: 'P0'},
  ],
  ['00:02:00', {time: '00:02:00', action: 'next'}],
  ['00:03:50', {time: '00:03:00', action: 'end'}],
]

test.each(cases)('get current cue', (input, expected) => {
  expect(getCurrentCue(input, DEMO_SEQ)?.[1]).to.deep.eq(expected)
})
