export const SENTENCE_TO_IMAGE_PROMPT = `You are a system that extracts meaningful image prompts from a set of words. Identify important keywords in the given sentence. Produce a JSON object with 1 field, "image_prompt", a highly descriptive, detailed image prompt.`

const TEMPERATURE = 0.8

export async function gpt(
  system: string,
  input: string
): Promise<string | null> {
  const endpoint = 'https://api.openai.com/v1/chat/completions'

  const token = localStorage.getItem('OPENAI_KEY') ?? ''

  if (!token) {
    throw new Error('No OpenAI key found at OPENAI_KEY')
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: input},
        ],
        temperature: TEMPERATURE,
        max_tokens: 200,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    })

    const json = await res.json()
    const content = json.choices[0].message.content
    const body = JSON.parse(content)

    return body.image_prompt ?? null
  } catch (err) {
    console.warn('GPT error:', err)

    return null
  }
}

export const sentenceToImagePrompt = (sentence: string) =>
  gpt(SENTENCE_TO_IMAGE_PROMPT, sentence)
