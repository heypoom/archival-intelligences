import {DictationCaption, DictationTrigger} from './dictation'
import {ImageDisplay} from './image/ImageDisplay'

function App() {
  return (
    <div>
      <div className="fixed font-mono w-full min-h-screen flex left-0 justify-center items-center pt-12 pointer-events-none">
        <DictationCaption />
      </div>

      <div className="fixed right-3 bottom-3">
        <DictationTrigger />
      </div>

      <ImageDisplay />
    </div>
  )
}

export default App
