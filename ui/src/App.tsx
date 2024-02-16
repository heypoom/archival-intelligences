import {DictationCaption, DictationTrigger, DictationLogs} from './dictation'
import {ImageDisplay} from './image/ImageDisplay'

function App() {
  return (
    <div>
      <div className="fixed w-full flex left-0 justify-center pt-12">
        <DictationCaption />
      </div>

      <div className="fixed right-3 bottom-3">
        <DictationTrigger />
      </div>

      <div className="fixed left-3 bottom-3">
        <DictationLogs />
      </div>

      <ImageDisplay />
    </div>
  )
}

export default App
