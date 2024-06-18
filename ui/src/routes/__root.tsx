import {Outlet, createRootRoute} from '@tanstack/react-router'

import {HeadlessController} from '../components/HeadlessController'
import {StatusIndicator} from '../dictation'
import {CurrentProgramBadge} from '../components/CurrentProgramBadge'
import FadeToBlack from '../components/FadeToBlack'
import {ProgressBadge} from '../components/ProgressBadge'
import {AnimatedNoise} from '../components/AnimatedNoise'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <HeadlessController />

      <div className="fixed flex left-3 bottom-3 z-10 gap-x-1">
        <CurrentProgramBadge />
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
