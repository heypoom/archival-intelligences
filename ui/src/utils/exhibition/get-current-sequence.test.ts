import {expect, test} from 'vitest'
import {getCurrentSequence} from './get-current-sequence'
import {AutomationSequence} from '../../constants/exhibition-sequences'

export const DEMO_SEQ: AutomationSequence[] = [
  {time: '00:01:00', action: 'prompt', prompt: 'b'},
  {time: '00:02:00', action: 'next'},
  {time: '00:03:00', action: 'end'},
]

const cases: [string, AutomationSequence | undefined][] = [
  ['00:00:59', undefined],
  ['00:01:00', {time: '00:01:00', action: 'prompt', prompt: 'b'}],
  ['00:01:59', {time: '00:01:00', action: 'prompt', prompt: 'b'}],
  ['00:02:00', {time: '00:02:00', action: 'next'}],
  ['00:03:50', {time: '00:03:00', action: 'end'}],
]

test.each(cases)('get next sequence', (input, expected) => {
  expect(getCurrentSequence(input, DEMO_SEQ)?.[1]).to.deep.eq(expected)
})
