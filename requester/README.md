# Generation Requester

This simple Bun script makes requests to the Modal endpoint using the `fetch` API.

It reads the cues (see `cli/cue-check.ts` for a reference of how to read `cues.json`). For now, let's focus on transcript cues `transcriptCuesToGenerate` first.

It should use `p-queue` to limit the request concurrency to 3 requests at a time. Once the request is complete, it moves on to the next request in the queue.

### For text-to-image programs

Sends a POST request to the `/generate` endpoint on the "pregen-text-to-image" modal function.

It takes:

- `cue_id`: The ID of the cue to generate an image for.
- `prompt`: The text prompt for the image generation.
- `program_key`: The key of the program to use for image generation. (example: "P0", "P4")

```http
POST https://heypoom--exhibition-pregen-text-to-image-endpoint.modal.run/generate

Content-Type: application/json

{
  "prompt": "your prompt here",
  "program_key": "P0",
  "cue_id": "1",
}
```

### Use Valkey to mark processing as done

Bun supports Valkey, a Redis-compatible database. We use it to mark cues as processed. The Valkey instance is hosted at `raya.poom.dev:6379`.

Sample code:

```ts
import {RedisClient} from 'bun'

const valkey = new RedisClient('redis://raya.poom.dev:6379')
await valkey.set('foo', 'bar')
```

Let's use `hincrby "requests/cues" <cue_id> 1` to increment the number of requests made for a cue. This will help us track how many requests have been made so far for each cue.

Let's also use `hset "requests/cue/prompts" <cue_id> <prompt>` to store the prompt used for each cue. This is for double-checking.
