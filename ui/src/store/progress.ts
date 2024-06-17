import {atom, computed} from 'nanostores'

export const $timestep = atom(0)
export const $startTimestep = atom(0)

export const $progress = computed([$timestep, $startTimestep], (now, start) => {
  return 100 - (now / start) * 100
})
