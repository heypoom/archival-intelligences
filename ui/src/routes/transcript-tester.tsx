import {createFileRoute} from '@tanstack/react-router'
import {DictationCaption} from '../dictation'
import {ImageDisplay} from '../image/ImageDisplay'
import {useEffect} from 'react'
import {$transcript} from '../store/dictation'

const TranscriptTester = () => {
  useEffect(() => {
    // simulate a really long lorem ipsum
    const transcript =
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur'

    $transcript.set({transcript, final: true})
  }, [])

  return (
    <main>
      <div className="fixed font-mono w-full min-h-screen flex left-0 justify-center items-center pt-12 pointer-events-none z-[50]">
        <DictationCaption />
      </div>
    </main>
  )
}

export const Route = createFileRoute('/transcript-tester')({
  component: TranscriptTester,
})
