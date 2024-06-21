import {createLazyFileRoute} from '@tanstack/react-router'

import {DictationCaption, dictation} from '../dictation'
import {ImageDisplay} from '../image/ImageDisplay'

import {useHotkeys} from 'react-hotkeys-hook'

import {socket} from '../manager/socket'

export const Route = createLazyFileRoute('/')({
  component: Index,
})

function Index() {
  useHotkeys('space', () => {
    socket.reconnectSoon('spacebar hotkey', 5)
    dictation.restart('spacebar hotkey')
  })

  return (
    <main>
      <div className="fixed font-mono w-full min-h-screen flex left-0 justify-center items-center pt-12 pointer-events-none z-[50]">
        <DictationCaption />
      </div>

      <ImageDisplay />
    </main>
  )
}
