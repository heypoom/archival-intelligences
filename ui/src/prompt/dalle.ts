type Image = {url: string; revised_prompt: string}
type ResponseData = {created: number; data: Image[]}

export async function generateImage(prompt: string): Promise<Image[] | null> {
  const endpoint = 'https://api.openai.com/v1/images/generations'
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
        prompt,
        model: 'dall-e-3',
        n: 1,
        size: '1024x1024',
        style: 'vivid',
        response_format: 'url',
        quality: 'hd',
      }),
    })

    const json: ResponseData = await res.json()

    return json.data
  } catch (err) {
    console.warn('GPT error:', err)
    return null
  }
}
