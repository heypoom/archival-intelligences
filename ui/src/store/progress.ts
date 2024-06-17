import {atom, computed} from 'nanostores'

export const $timestep = atom(0)
export const $startTimestep = atom(0)

export const $progress = computed([$timestep, $startTimestep], (now, start) => {
  if (start === 0 && now === 0) return 0

  return 100 - (now / start) * 100
})

export function resetProgress() {
  $timestep.set(0)
  $startTimestep.set(0)
}
