import {Outlet, createRootRoute} from '@tanstack/react-router'

import {HeadlessController} from '../components/HeadlessController'
import {StatusIndicator} from '../dictation'
import {CurrentProgramBadge} from '../components/CurrentProgramBadge'
import FadeToBlack from '../components/FadeToBlack'
import {ProgressBadge} from '../components/ProgressBadge'
import {AnimatedNoise} from '../components/AnimatedNoise'
import {RegenCountBadge} from '../components/RegenCountBadge'
import {ExhibitionFallbackVideo} from '../components/ExhibitionFallbackVideo'

export const Route = createRootRoute({
  component: () => (
    <>
      <ExhibitionFallbackVideo />

      <Outlet />
      <HeadlessController />

      <div className="fixed flex left-3 bottom-3 z-10 gap-x-1">
        <CurrentProgramBadge />
        <RegenCountBadge />
        <ProgressBadge />
      </div>

      <div className="fixed right-3 bottom-3 z-10">
        <StatusIndicator />
      </div>

      <FadeToBlack />
      <AnimatedNoise />
    </>
  ),
})
