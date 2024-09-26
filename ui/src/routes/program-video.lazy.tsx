import {createLazyFileRoute} from '@tanstack/react-router'

import {ExhibitionProgramVideo} from '../components/ExhibitionFallbackVideo'

export const Route = createLazyFileRoute('/program-video')({
  component: ProgramVideoRoute,
})

function ProgramVideoRoute() {
  return <ExhibitionProgramVideo />
}
