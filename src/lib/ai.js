const SINGLE_CRITIQUE_PROMPT = `You are an expert photography critic. Analyze this photograph and provide a detailed critique.

Evaluate the image on these four criteria, each scored from 1 to 10:
1. **Composition** — Rule of thirds, leading lines, framing, balance
2. **Lighting** — Quality, direction, contrast, shadows/highlights
3. **Color Balance** — Harmony, saturation, temperature, mood
4. **Technical Quality** — Sharpness, noise, exposure, depth of field

Respond ONLY with valid JSON in this exact format:
{
  "overall_rating": <number 1-10>,
  "composition": <number 1-10>,
  "lighting": <number 1-10>,
  "color_balance": <number 1-10>,
  "technical_quality": <number 1-10>,
  "feedback": [
    "<constructive feedback point 1>",
    "<constructive feedback point 2>",
    "<constructive feedback point 3>",
    "<constructive feedback point 4 (optional)>",
    "<constructive feedback point 5 (optional)>"
  ],
  "summary": "<1-2 sentence overall summary>"
}`

const COMPARE_PROMPT = `You are an expert photography critic. Compare these two photographs and determine which is the better shot.

Evaluate EACH image on these four criteria, each scored from 1 to 10:
1. **Composition** — Rule of thirds, leading lines, framing, balance
2. **Lighting** — Quality, direction, contrast, shadows/highlights
3. **Color Balance** — Harmony, saturation, temperature, mood
4. **Technical Quality** — Sharpness, noise, exposure, depth of field

Respond ONLY with valid JSON in this exact format:
{
  "image_a": {
    "overall_rating": <number 1-10>,
    "composition": <number 1-10>,
    "lighting": <number 1-10>,
    "color_balance": <number 1-10>,
    "technical_quality": <number 1-10>,
    "feedback": ["<point 1>", "<point 2>", "<point 3>"],
    "summary": "<1-2 sentence summary>"
  },
  "image_b": {
    "overall_rating": <number 1-10>,
    "composition": <number 1-10>,
    "lighting": <number 1-10>,
    "color_balance": <number 1-10>,
    "technical_quality": <number 1-10>,
    "feedback": ["<point 1>", "<point 2>", "<point 3>"],
    "summary": "<1-2 sentence summary>"
  },
  "winner": "<A or B>",
  "reason": "<Brief explanation of why the winner is better>"
}`

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function critiquePhoto(file, apiKey, provider = 'openai') {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/jpeg'

  if (provider === 'gemini') {
    return callGemini(apiKey, SINGLE_CRITIQUE_PROMPT, [{ base64, mimeType }])
  }
  return callOpenAI(apiKey, SINGLE_CRITIQUE_PROMPT, [{ base64, mimeType }])
}

export async function comparePhotos(fileA, fileB, apiKey, provider = 'openai') {
  const [base64A, base64B] = await Promise.all([fileToBase64(fileA), fileToBase64(fileB)])
  const mimeA = fileA.type || 'image/jpeg'
  const mimeB = fileB.type || 'image/jpeg'

  const images = [
    { base64: base64A, mimeType: mimeA },
    { base64: base64B, mimeType: mimeB },
  ]

  if (provider === 'gemini') {
    return callGemini(apiKey, COMPARE_PROMPT, images)
  }
  return callOpenAI(apiKey, COMPARE_PROMPT, images)
}

async function callOpenAI(apiKey, prompt, images) {
  const imageContent = images.map((img, i) => ({
    type: 'image_url',
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
      detail: 'high',
    },
  }))

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent,
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices[0].message.content
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

async function callGemini(apiKey, prompt, images) {
  const parts = [{ text: prompt }]
  images.forEach((img) => {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64,
      },
    })
  })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`)
  }

  const data = await res.json()
  const text = data.candidates[0].content.parts[0].text
  return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}
