// Hybrid image analysis engine:
// 1. Client-side pixel analysis → numerical scores (instant, no API)
// 2. Gemini 2.0 Flash Vision → content-aware descriptive feedback (free API key)

// ============================================================
// PIXEL ANALYSIS (scores)
// ============================================================

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function getPixelData(img, maxSize = 400) {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height),
    width: canvas.width,
    height: canvas.height,
  }
}

function analyzeImage(pixels) {
  const { data, width, height } = pixels
  const d = data.data
  const totalPixels = width * height

  let brightnessSum = 0
  const brightnessArr = new Float32Array(totalPixels)
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]
    brightnessArr[i] = lum
    brightnessSum += lum
  }
  const avgBrightness = brightnessSum / totalPixels

  let contrastSum = 0
  for (let i = 0; i < totalPixels; i++) {
    const diff = brightnessArr[i] - avgBrightness
    contrastSum += diff * diff
  }
  const contrast = Math.sqrt(contrastSum / totalPixels)

  let satSum = 0
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    satSum += max === 0 ? 0 : (max - min) / max
  }
  const avgSaturation = satSum / totalPixels

  const histogram = new Array(256).fill(0)
  for (let i = 0; i < totalPixels; i++) histogram[Math.round(brightnessArr[i])]++
  const shadowClip = histogram.slice(0, 10).reduce((a, b) => a + b, 0) / totalPixels
  const highlightClip = histogram.slice(246).reduce((a, b) => a + b, 0) / totalPixels

  let rTotal = 0, bTotal = 0
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    rTotal += d[idx]; bTotal += d[idx + 2]
  }
  const warmth = rTotal / (bTotal || 1)

  let sharpSum = 0, sharpCount = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap = -4 * brightnessArr[i] + brightnessArr[i - 1] + brightnessArr[i + 1] + brightnessArr[i - width] + brightnessArr[i + width]
      sharpSum += lap * lap; sharpCount++
    }
  }
  const sharpness = Math.sqrt(sharpSum / sharpCount)

  const thirdW = width / 3, thirdH = height / 3
  const powerPoints = [[thirdW, thirdH], [2 * thirdW, thirdH], [thirdW, 2 * thirdH], [2 * thirdW, 2 * thirdH]]
  const regionSize = Math.max(10, Math.round(Math.min(width, height) * 0.08))
  let interestAtThirds = 0, totalInterest = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const edge = Math.abs(brightnessArr[i] - brightnessArr[i - 1]) + Math.abs(brightnessArr[i] - brightnessArr[i - width])
      totalInterest += edge
      for (const [px, py] of powerPoints) {
        if (Math.abs(x - px) < regionSize && Math.abs(y - py) < regionSize) { interestAtThirds += edge; break }
      }
    }
  }
  const thirdsScore = totalInterest > 0 ? interestAtThirds / totalInterest : 0

  const hueBins = new Set()
  for (let i = 0; i < totalPixels; i += 3) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 20) continue
    let h = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hueBins.add(Math.floor(h / 30))
  }
  const colorVariety = hueBins.size / 12

  let symDiff = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < Math.floor(width / 2); x++) {
      symDiff += Math.abs(brightnessArr[y * width + x] - brightnessArr[y * width + (width - 1 - x)])
    }
  }
  const symmetry = 1 - symDiff / (totalPixels * 128)

  // Artistic metrics
  const edgeMap = new Float32Array(totalPixels)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      edgeMap[i] = Math.abs(brightnessArr[i] - brightnessArr[i - 1]) + Math.abs(brightnessArr[i] - brightnessArr[i + 1]) +
                   Math.abs(brightnessArr[i] - brightnessArr[i - width]) + Math.abs(brightnessArr[i] - brightnessArr[i + width])
    }
  }
  let edgeMax = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] > edgeMax) edgeMax = edgeMap[i]
  const edgeThreshold = edgeMax * 0.1
  let quietPixels = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] < edgeThreshold) quietPixels++
  const negativeSpace = quietPixels / totalPixels

  const blockSize = Math.max(8, Math.round(Math.min(width, height) * 0.06))
  let maxBlockEdge = 0, totalEdge = 0
  for (let by = 0; by < height - blockSize; by += Math.ceil(blockSize / 2)) {
    for (let bx = 0; bx < width - blockSize; bx += Math.ceil(blockSize / 2)) {
      let blockSum = 0
      for (let dy = 0; dy < blockSize; dy++) for (let dx = 0; dx < blockSize; dx++) blockSum += edgeMap[(by + dy) * width + (bx + dx)]
      if (blockSum > maxBlockEdge) maxBlockEdge = blockSum
      totalEdge += blockSum
    }
  }
  const focalStrength = totalEdge > 0 ? maxBlockEdge / (totalEdge * 0.15) : 0

  let firstBin = 255, lastBin = 0
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > totalPixels * 0.001) { if (i < firstBin) firstBin = i; if (i > lastBin) lastBin = i }
  }
  const tonalRange = (lastBin - firstBin) / 255

  const hueHistogram = new Array(12).fill(0)
  for (let i = 0; i < totalPixels; i += 2) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 25) continue
    let h = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hueHistogram[Math.floor(h / 30)]++
  }
  const hueTotal = hueHistogram.reduce((a, b) => a + b, 0)
  const hueFractions = hueHistogram.map((v) => (hueTotal > 0 ? v / hueTotal : 0))
  const dominantHues = hueFractions.map((f, i) => ({ idx: i, frac: f })).filter((h) => h.frac > 0.1)
  let harmonyScore = 0
  if (dominantHues.length === 1) { harmonyScore = 0.7 }
  else if (dominantHues.length >= 2) {
    for (let i = 0; i < dominantHues.length; i++) {
      for (let j = i + 1; j < dominantHues.length; j++) {
        const gap = Math.abs(dominantHues[i].idx - dominantHues[j].idx)
        const circleGap = Math.min(gap, 12 - gap)
        if (circleGap <= 2) harmonyScore += 0.4
        else if (circleGap >= 5 && circleGap <= 7) harmonyScore += 0.5
        else if (circleGap === 4 || circleGap === 8) harmonyScore += 0.35
        else harmonyScore += 0.15
      }
    }
    harmonyScore = Math.min(1, harmonyScore)
  }

  const centerX = width / 2, centerY = height / 2
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY)
  let innerBrightness = 0, outerBrightness = 0, innerCount = 0, outerCount = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDist
      const lum = brightnessArr[y * width + x]
      if (dist < 0.35) { innerBrightness += lum; innerCount++ }
      else if (dist > 0.65) { outerBrightness += lum; outerCount++ }
    }
  }
  const depthGradient = Math.abs((innerCount > 0 ? innerBrightness / innerCount : 128) - (outerCount > 0 ? outerBrightness / outerCount : 128)) / 128

  let edgeMean = 0, edgeCount = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] > 0) { edgeMean += edgeMap[i]; edgeCount++ }
  edgeMean = edgeCount > 0 ? edgeMean / edgeCount : 0
  let edgeVariance = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] > 0) { const diff = edgeMap[i] - edgeMean; edgeVariance += diff * diff }
  const textureComplexity = edgeCount > 0 ? Math.sqrt(edgeVariance / edgeCount) : 0

  return {
    avgBrightness, contrast, avgSaturation, shadowClip, highlightClip,
    warmth, sharpness, thirdsScore, colorVariety, symmetry,
    aspectRatio: width / height,
    negativeSpace, focalStrength, tonalRange, harmonyScore, depthGradient, textureComplexity,
  }
}

function scoreFromAnalysis(a) {
  let composition = 5
  composition += Math.min(2.5, a.thirdsScore * 25)
  composition += a.symmetry > 0.7 ? 1 : a.symmetry > 0.5 ? 0.5 : 0
  const goodRatios = [16 / 9, 4 / 3, 3 / 2, 1, 2 / 3, 3 / 4]
  composition += Math.min(...goodRatios.map((r) => Math.abs(a.aspectRatio - r))) < 0.1 ? 0.5 : 0
  composition = Math.max(1, Math.min(10, Math.round(composition)))

  let lighting = 5
  lighting += (1 - Math.abs(a.avgBrightness - 130) / 130) * 2
  lighting += Math.min(1, a.contrast / 70) * 2
  lighting -= a.shadowClip * 8 + a.highlightClip * 8
  lighting = Math.max(1, Math.min(10, Math.round(lighting)))

  let colorBalance = 5
  colorBalance += (1 - Math.min(1, Math.abs(a.avgSaturation - 0.4) / 0.4)) * 2
  colorBalance += (1 - Math.min(1, Math.abs(a.warmth - 1.1) / 1.1))
  colorBalance += a.colorVariety * 1.5
  colorBalance = Math.max(1, Math.min(10, Math.round(colorBalance)))

  let technical = 5
  technical += Math.min(1, a.sharpness / 25) * 3
  if (a.avgBrightness < 40 || a.avgBrightness > 230) technical -= 2
  technical -= (a.shadowClip + a.highlightClip) * 4
  technical = Math.max(1, Math.min(10, Math.round(technical)))

  let artistic = 4
  artistic += (1 - Math.abs(a.negativeSpace - 0.45) / 0.45) * 1.5
  artistic += Math.min(2, a.focalStrength * 1.2)
  artistic += a.tonalRange * 1.5
  artistic += a.harmonyScore * 1.5
  artistic += Math.min(1, a.depthGradient * 4)
  const texNorm = Math.min(1, a.textureComplexity / 30)
  artistic += (1 - Math.abs(texNorm - 0.5) * 2) * 1
  artistic = Math.max(1, Math.min(10, Math.round(artistic)))

  const overall = Math.round((composition + lighting + colorBalance + technical + artistic) / 5)
  return { overall_rating: overall, composition, lighting, color_balance: colorBalance, technical_quality: technical, artistic_quality: artistic }
}

function getPixelScores(file) {
  return loadImage(file).then((img) => {
    const pixels = getPixelData(img)
    URL.revokeObjectURL(img.src)
    return scoreFromAnalysis(analyzeImage(pixels))
  })
}

// ============================================================
// GEMINI VISION (content-aware feedback)
// ============================================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const SINGLE_PROMPT = (scores) => `You are an expert photography critic reviewing a photograph.
The image has already been scored on these technical metrics:
- Composition: ${scores.composition}/10
- Lighting: ${scores.lighting}/10
- Color Balance: ${scores.color_balance}/10
- Technical Quality: ${scores.technical_quality}/10
- Artistic Quality: ${scores.artistic_quality}/10
- Overall: ${scores.overall_rating}/10

Now provide a CONTENT-AWARE critique. You must:
1. DESCRIBE what you actually see in the photo (the subject, scene, objects, people, environment, textures, materials, weather, mood, etc.)
2. Explain SPECIFICALLY what works well, referencing actual visible elements (e.g., "the warm sunlight on the brick wall", "the reflection in the puddle", "the subject's expression")
3. Explain what could be improved, referencing actual visible elements (e.g., "the trash bin in the corner is distracting", "the sky is slightly overexposed")
4. Give the overall artistic impression describing the mood/feeling the photo evokes

Respond ONLY with valid JSON:
{
  "feedback": [
    "<descriptive feedback point about what works well, referencing visible content>",
    "<descriptive feedback point about composition/framing of the actual scene>",
    "<descriptive feedback point about lighting and how it affects the specific subject>",
    "<descriptive feedback point about what could be improved, referencing specific visible elements>",
    "<descriptive overall artistic impression of the scene and mood>"
  ],
  "summary": "<2-3 sentence summary that describes what the photo shows, its strengths, and its mood — like a mini review>"
}`

const COMPARE_PROMPT = (scoresA, scoresB) => `You are an expert photography critic comparing two photographs side by side.

Image A scores: Composition ${scoresA.composition}/10, Lighting ${scoresA.lighting}/10, Color ${scoresA.color_balance}/10, Technical ${scoresA.technical_quality}/10, Artistic ${scoresA.artistic_quality}/10, Overall ${scoresA.overall_rating}/10
Image B scores: Composition ${scoresB.composition}/10, Lighting ${scoresB.lighting}/10, Color ${scoresB.color_balance}/10, Technical ${scoresB.technical_quality}/10, Artistic ${scoresB.artistic_quality}/10, Overall ${scoresB.overall_rating}/10

For EACH image, provide content-aware feedback:
1. DESCRIBE what you see (subject, scene, objects, environment, mood)
2. What works well (reference actual visible elements)
3. What could be improved (reference actual visible elements)

Then pick a winner and explain WHY by comparing specific visible elements.

Respond ONLY with valid JSON:
{
  "image_a": {
    "feedback": ["<point 1>", "<point 2>", "<point 3>"],
    "summary": "<2-3 sentence description and mini review of image A>"
  },
  "image_b": {
    "feedback": ["<point 1>", "<point 2>", "<point 3>"],
    "summary": "<2-3 sentence description and mini review of image B>"
  },
  "winner": "${scoresA.overall_rating >= scoresB.overall_rating ? 'A' : 'B'}",
  "reason": "<Specific comparison referencing visible content in both images, explaining why the winner is stronger>"
}`

async function callGemini(apiKey, prompt, images) {
  const parts = [{ text: prompt }]
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200, responseMimeType: 'application/json' },
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

// ============================================================
// PUBLIC API
// ============================================================

export function getApiKey() {
  return localStorage.getItem('photocritic_gemini_key') || ''
}

export function saveApiKey(key) {
  localStorage.setItem('photocritic_gemini_key', key)
}

export async function critiquePhoto(file) {
  const apiKey = getApiKey()

  // Step 1: Pixel analysis for scores (instant)
  const scores = await getPixelScores(file)

  // Step 2: Gemini vision for content-aware feedback
  if (!apiKey) {
    throw new Error('API_KEY_MISSING')
  }

  const base64 = await fileToBase64(file)
  const prompt = SINGLE_PROMPT(scores)
  const aiResult = await callGemini(apiKey, prompt, [{ base64, mimeType: file.type || 'image/jpeg' }])

  return {
    ...scores,
    feedback: aiResult.feedback || [],
    summary: aiResult.summary || '',
  }
}

export async function comparePhotos(fileA, fileB) {
  const apiKey = getApiKey()

  // Step 1: Pixel analysis for both images
  const [scoresA, scoresB] = await Promise.all([getPixelScores(fileA), getPixelScores(fileB)])

  // Step 2: Gemini vision for comparison
  if (!apiKey) {
    throw new Error('API_KEY_MISSING')
  }

  const [base64A, base64B] = await Promise.all([fileToBase64(fileA), fileToBase64(fileB)])
  const prompt = COMPARE_PROMPT(scoresA, scoresB)
  const aiResult = await callGemini(apiKey, prompt, [
    { base64: base64A, mimeType: fileA.type || 'image/jpeg' },
    { base64: base64B, mimeType: fileB.type || 'image/jpeg' },
  ])

  const winner = scoresA.overall_rating >= scoresB.overall_rating ? 'A' : 'B'

  return {
    image_a: { ...scoresA, feedback: aiResult.image_a?.feedback || [], summary: aiResult.image_a?.summary || '' },
    image_b: { ...scoresB, feedback: aiResult.image_b?.feedback || [], summary: aiResult.image_b?.summary || '' },
    winner: aiResult.winner || winner,
    reason: aiResult.reason || `Image ${winner} has stronger overall scores.`,
  }
}
