import {useStore} from '@nanostores/react'

import {$transcripts} from '../../store/dictation'

const MAX_TRANSCRIPT_SHOWN = 5

export const DictationLogs = () => {
  const transcripts = useStore($transcripts)
  const logs = transcripts.slice(0, MAX_TRANSCRIPT_SHOWN)

  return (
    <div className="flex flex-col text-xl text-left text-gray-500">
      {logs.map((transcript, index) => (
        <div key={index}>{transcript}</div>
      ))}
    </div>
  )
}
