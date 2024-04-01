import { useStore } from "@nanostores/react";

import { $transcripts } from "../../store/dictation";
import { $imagePrompts } from "../../store/images";

const MAX_TRANSCRIPT_SHOWN = 5;

export const DictationLogs = () => {
  const transcripts = useStore($transcripts);
  const logs = transcripts.slice(0, MAX_TRANSCRIPT_SHOWN);

  const prompts = useStore($imagePrompts);

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-col text-2xl text-left text-gray-500">
        {logs.map((log) => (
          <div key={log.id}>{log.transcript}</div>
        ))}
      </div>

      <div className="flex flex-col text-xs text-left text-gray-600">
        {prompts.map((prompt) => (
          <div key={prompt.id}>{prompt.prompt}</div>
        ))}
      </div>
    </div>
  );
};
