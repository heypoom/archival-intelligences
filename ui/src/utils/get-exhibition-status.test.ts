import {test, expect} from 'vitest'

import {parseTime} from './date'
import {getExhibitionStatus} from './get-exhibition-status'

import {ExhibitionStatus} from '../types/exhibition-status'

const cases: [string, ExhibitionStatus][] = [
  ['10:30', {type: 'wait', next: '11:00'}],
  ['11:00', {type: 'active', start: '11:00'}],
  ['11:30', {type: 'active', start: '11:00'}],
  ['15:00', {type: 'active', start: '14:00'}],
  ['18:00', {type: 'active', start: '17:00'}],
  ['21:30', {type: 'closed'}],
  ['22:00', {type: 'closed'}],
]

test.each(cases)('get exhibition status', (time, status) => {
  expect(getExhibitionStatus(parseTime(time))).to.deep.equal(status)
})
