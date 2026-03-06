// Client-side image analysis engine — no API keys needed.
// Analyzes actual pixel data for brightness, contrast, saturation,
// sharpness, color harmony, rule-of-thirds composition, and more.

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

  // === BRIGHTNESS ===
  let brightnessSum = 0
  const brightnessArr = new Float32Array(totalPixels)
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]
    brightnessArr[i] = lum
    brightnessSum += lum
  }
  const avgBrightness = brightnessSum / totalPixels

  // === CONTRAST (std dev of brightness) ===
  let contrastSum = 0
  for (let i = 0; i < totalPixels; i++) {
    const diff = brightnessArr[i] - avgBrightness
    contrastSum += diff * diff
  }
  const contrast = Math.sqrt(contrastSum / totalPixels)

  // === SATURATION ===
  let satSum = 0
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    satSum += max === 0 ? 0 : (max - min) / max
  }
  const avgSaturation = satSum / totalPixels

  // === HISTOGRAM CLIPPING ===
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < totalPixels; i++) {
    histogram[Math.round(brightnessArr[i])]++
  }
  const shadowClip = histogram.slice(0, 10).reduce((a, b) => a + b, 0) / totalPixels
  const highlightClip = histogram.slice(246).reduce((a, b) => a + b, 0) / totalPixels

  // === COLOR TEMPERATURE ===
  let rTotal = 0, bTotal = 0
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    rTotal += d[idx]
    bTotal += d[idx + 2]
  }
  const warmth = rTotal / (bTotal || 1)

  // === SHARPNESS (Laplacian variance) ===
  let sharpSum = 0
  let sharpCount = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap =
        -4 * brightnessArr[i] +
        brightnessArr[i - 1] +
        brightnessArr[i + 1] +
        brightnessArr[i - width] +
        brightnessArr[i + width]
      sharpSum += lap * lap
      sharpCount++
    }
  }
  const sharpness = Math.sqrt(sharpSum / sharpCount)

  // === RULE OF THIRDS ===
  const thirdW = width / 3
  const thirdH = height / 3
  const powerPoints = [
    [thirdW, thirdH],
    [2 * thirdW, thirdH],
    [thirdW, 2 * thirdH],
    [2 * thirdW, 2 * thirdH],
  ]
  const regionSize = Math.max(10, Math.round(Math.min(width, height) * 0.08))
  let interestAtThirds = 0
  let totalInterest = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const edge = Math.abs(brightnessArr[i] - brightnessArr[i - 1]) +
                   Math.abs(brightnessArr[i] - brightnessArr[i - width])
      totalInterest += edge

      for (const [px, py] of powerPoints) {
        if (Math.abs(x - px) < regionSize && Math.abs(y - py) < regionSize) {
          interestAtThirds += edge
          break
        }
      }
    }
  }
  const thirdsScore = totalInterest > 0 ? interestAtThirds / totalInterest : 0

  // === COLOR VARIETY ===
  const hueBins = new Set()
  for (let i = 0; i < totalPixels; i += 3) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 20) continue
    let h = 0
    if (max === r) h = ((g - b) / (max - min)) * 60
    else if (max === g) h = (2 + (b - r) / (max - min)) * 60
    else h = (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hueBins.add(Math.floor(h / 30))
  }
  const colorVariety = hueBins.size / 12

  // === SYMMETRY ===
  let symDiff = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < Math.floor(width / 2); x++) {
      const left = y * width + x
      const right = y * width + (width - 1 - x)
      symDiff += Math.abs(brightnessArr[left] - brightnessArr[right])
    }
  }
  const symmetry = 1 - symDiff / (totalPixels * 128)

  // === ARTISTIC QUALITY METRICS ===

  // --- Negative Space: ratio of "quiet" (low-edge) pixels ---
  const edgeMap = new Float32Array(totalPixels)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      edgeMap[i] = Math.abs(brightnessArr[i] - brightnessArr[i - 1]) +
                   Math.abs(brightnessArr[i] - brightnessArr[i + 1]) +
                   Math.abs(brightnessArr[i] - brightnessArr[i - width]) +
                   Math.abs(brightnessArr[i] - brightnessArr[i + width])
    }
  }
  let edgeMax = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] > edgeMax) edgeMax = edgeMap[i]
  const edgeThreshold = edgeMax * 0.1
  let quietPixels = 0
  for (let i = 0; i < totalPixels; i++) if (edgeMap[i] < edgeThreshold) quietPixels++
  const negativeSpace = quietPixels / totalPixels // 0-1, higher = more blank space

  // --- Focal Point Strength: how concentrated the visual interest is ---
  // Find the peak interest region (16x16 block with highest edge sum)
  const blockSize = Math.max(8, Math.round(Math.min(width, height) * 0.06))
  let maxBlockEdge = 0
  let totalEdge = 0
  for (let by = 0; by < height - blockSize; by += Math.ceil(blockSize / 2)) {
    for (let bx = 0; bx < width - blockSize; bx += Math.ceil(blockSize / 2)) {
      let blockSum = 0
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          blockSum += edgeMap[(by + dy) * width + (bx + dx)]
        }
      }
      if (blockSum > maxBlockEdge) maxBlockEdge = blockSum
      totalEdge += blockSum
    }
  }
  const focalStrength = totalEdge > 0 ? maxBlockEdge / (totalEdge * 0.15) : 0 // higher = stronger focal point

  // --- Tonal Range: how much of the histogram is actually used ---
  let firstBin = 255, lastBin = 0
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > totalPixels * 0.001) {
      if (i < firstBin) firstBin = i
      if (i > lastBin) lastBin = i
    }
  }
  const tonalRange = (lastBin - firstBin) / 255 // 0-1, how much of the brightness range is used

  // --- Color Harmony: check for complementary / analogous relationships ---
  const hueHistogram = new Array(12).fill(0)
  for (let i = 0; i < totalPixels; i += 2) {
    const idx = i * 4
    const r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 25) continue
    let h = 0
    if (max === r) h = ((g - b) / (max - min)) * 60
    else if (max === g) h = (2 + (b - r) / (max - min)) * 60
    else h = (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hueHistogram[Math.floor(h / 30)]++
  }
  const hueTotal = hueHistogram.reduce((a, b) => a + b, 0)
  const hueFractions = hueHistogram.map((v) => (hueTotal > 0 ? v / hueTotal : 0))
  // Find dominant hue bins (>10% of colored pixels)
  const dominantHues = hueFractions.map((f, i) => ({ idx: i, frac: f })).filter((h) => h.frac > 0.1)
  let harmonyScore = 0
  if (dominantHues.length === 1) {
    harmonyScore = 0.7 // monochromatic = decent harmony
  } else if (dominantHues.length >= 2) {
    for (let i = 0; i < dominantHues.length; i++) {
      for (let j = i + 1; j < dominantHues.length; j++) {
        const gap = Math.abs(dominantHues[i].idx - dominantHues[j].idx)
        const circleGap = Math.min(gap, 12 - gap)
        if (circleGap <= 2) harmonyScore += 0.4        // analogous
        else if (circleGap >= 5 && circleGap <= 7) harmonyScore += 0.5 // complementary
        else if (circleGap === 4 || circleGap === 8) harmonyScore += 0.35 // triadic-ish
        else harmonyScore += 0.15 // discordant
      }
    }
    harmonyScore = Math.min(1, harmonyScore)
  }

  // --- Depth Perception: brightness gradient from edges to center ---
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
  const avgInner = innerCount > 0 ? innerBrightness / innerCount : 128
  const avgOuter = outerCount > 0 ? outerBrightness / outerCount : 128
  const depthGradient = Math.abs(avgInner - avgOuter) / 128 // natural vignette / depth effect

  // --- Visual Texture Complexity: variance of edge intensities ---
  let edgeMean = 0
  let edgeCount = 0
  for (let i = 0; i < totalPixels; i++) {
    if (edgeMap[i] > 0) { edgeMean += edgeMap[i]; edgeCount++ }
  }
  edgeMean = edgeCount > 0 ? edgeMean / edgeCount : 0
  let edgeVariance = 0
  for (let i = 0; i < totalPixels; i++) {
    if (edgeMap[i] > 0) {
      const diff = edgeMap[i] - edgeMean
      edgeVariance += diff * diff
    }
  }
  const textureComplexity = edgeCount > 0 ? Math.sqrt(edgeVariance / edgeCount) : 0

  return {
    avgBrightness, contrast, avgSaturation, shadowClip, highlightClip,
    warmth, sharpness, thirdsScore, colorVariety, symmetry,
    aspectRatio: width / height,
    // Artistic metrics
    negativeSpace, focalStrength, tonalRange,
    harmonyScore, depthGradient, textureComplexity,
  }
}

function scoreFromAnalysis(a) {
  let composition = 5
  composition += Math.min(2.5, a.thirdsScore * 25)
  composition += a.symmetry > 0.7 ? 1 : a.symmetry > 0.5 ? 0.5 : 0
  const goodRatios = [16 / 9, 4 / 3, 3 / 2, 1, 2 / 3, 3 / 4]
  const ratioDist = Math.min(...goodRatios.map((r) => Math.abs(a.aspectRatio - r)))
  composition += ratioDist < 0.1 ? 0.5 : 0
  composition = Math.max(1, Math.min(10, Math.round(composition)))

  let lighting = 5
  const brightDist = Math.abs(a.avgBrightness - 130) / 130
  lighting += (1 - brightDist) * 2
  const contrastNorm = Math.min(1, a.contrast / 70)
  lighting += contrastNorm * 2
  lighting -= a.shadowClip * 8
  lighting -= a.highlightClip * 8
  lighting = Math.max(1, Math.min(10, Math.round(lighting)))

  let colorBalance = 5
  const satDist = Math.abs(a.avgSaturation - 0.4) / 0.4
  colorBalance += (1 - Math.min(1, satDist)) * 2
  const warmDist = Math.abs(a.warmth - 1.1) / 1.1
  colorBalance += (1 - Math.min(1, warmDist))
  colorBalance += a.colorVariety * 1.5
  colorBalance = Math.max(1, Math.min(10, Math.round(colorBalance)))

  let technical = 5
  const sharpNorm = Math.min(1, a.sharpness / 25)
  technical += sharpNorm * 3
  if (a.avgBrightness < 40 || a.avgBrightness > 230) technical -= 2
  technical -= (a.shadowClip + a.highlightClip) * 4
  technical = Math.max(1, Math.min(10, Math.round(technical)))

  // --- ARTISTIC QUALITY ---
  let artistic = 4

  // Negative space: ~30-60% quiet area is ideal (breathing room without emptiness)
  const nsIdeal = 1 - Math.abs(a.negativeSpace - 0.45) / 0.45
  artistic += nsIdeal * 1.5

  // Focal point: strong focal point = more artistic intent
  artistic += Math.min(2, a.focalStrength * 1.2)

  // Tonal range: rich tones = better artistry
  artistic += a.tonalRange * 1.5

  // Color harmony: complementary / analogous palettes
  artistic += a.harmonyScore * 1.5

  // Depth perception: vignette / foreground-background separation
  artistic += Math.min(1, a.depthGradient * 4)

  // Texture complexity: moderate complexity is more artistic than flat or chaotic
  const texNorm = Math.min(1, a.textureComplexity / 30)
  const texIdeal = 1 - Math.abs(texNorm - 0.5) * 2 // peak at 0.5
  artistic += texIdeal * 1

  artistic = Math.max(1, Math.min(10, Math.round(artistic)))

  const overall = Math.round((composition + lighting + colorBalance + technical + artistic) / 5)

  return {
    overall_rating: overall, composition, lighting,
    color_balance: colorBalance, technical_quality: technical,
    artistic_quality: artistic,
  }
}

function generateFeedback(scores, analysis) {
  const feedback = []

  if (scores.composition >= 7) {
    feedback.push('Strong compositional balance — key elements align well with visual interest points.')
  } else if (scores.composition >= 5) {
    feedback.push('Try positioning your main subject along the rule-of-thirds gridlines for a more dynamic composition.')
  } else {
    feedback.push('The composition feels unbalanced. Consider repositioning the subject off-center using the rule of thirds.')
  }

  if (analysis.avgBrightness < 60) {
    feedback.push('The image is quite underexposed. Try increasing exposure or shooting in better light conditions.')
  } else if (analysis.avgBrightness > 210) {
    feedback.push('Several highlights are blown out. Reduce exposure or use fill lighting to balance the tones.')
  } else if (analysis.contrast < 25) {
    feedback.push('The image looks flat with low contrast. Try adjusting levels or shooting in more directional light.')
  } else if (scores.lighting >= 7) {
    feedback.push('Excellent use of light — the exposure and tonal range are well handled.')
  } else {
    feedback.push('The lighting is decent but could benefit from more contrast or directional light to add depth.')
  }

  if (analysis.avgSaturation < 0.1) {
    feedback.push('The colors appear very muted. If intentional, consider committing to a full black-and-white treatment.')
  } else if (analysis.avgSaturation > 0.7) {
    feedback.push('Saturation is quite high — pulling it back slightly would create a more natural, pleasing palette.')
  } else if (scores.color_balance >= 7) {
    feedback.push('Beautiful color palette — the tones harmonize well and create a cohesive mood.')
  } else {
    feedback.push('Consider adjusting white balance or color grading to create a more harmonious color palette.')
  }

  if (analysis.sharpness < 8) {
    feedback.push('The image appears soft — ensure your subject is in sharp focus and use a faster shutter speed if needed.')
  } else if (scores.technical_quality >= 8) {
    feedback.push('Technically excellent — sharp focus, clean exposure, and good detail preservation throughout.')
  } else if (scores.technical_quality >= 5) {
    feedback.push('Technical quality is solid. Minor improvements in sharpness or noise reduction could elevate the shot.')
  } else {
    feedback.push('Watch for camera shake or motion blur. Consider using a tripod or increasing your shutter speed.')
  }

  // Artistic feedback
  if (scores.artistic_quality >= 8) {
    feedback.push('Strong artistic vision — the image has a clear focal point, good use of space, and harmonious tonal depth.')
  } else if (analysis.negativeSpace < 0.15) {
    feedback.push('The frame feels very crowded. Leaving more negative space would let your subject breathe and create visual elegance.')
  } else if (analysis.negativeSpace > 0.75) {
    feedback.push('There is a lot of empty space — ensure it serves a purpose. Intentional negative space adds drama, but too much feels unfinished.')
  } else if (analysis.focalStrength < 0.3) {
    feedback.push('The image lacks a strong focal point. Guide the viewer\'s eye by creating contrast or isolation around your main subject.')
  } else if (analysis.harmonyScore < 0.3) {
    feedback.push('The color palette feels somewhat discordant. Try working with complementary or analogous color schemes for more visual unity.')
  } else if (analysis.tonalRange < 0.4) {
    feedback.push('The tonal range is narrow — using a wider range from deep shadows to bright highlights would add dimensionality.')
  } else if (analysis.depthGradient > 0.15) {
    feedback.push('Nice sense of depth — the tonal separation between foreground and background adds a three-dimensional feel.')
  } else {
    feedback.push('Consider creating more visual depth through layering, leading lines, or tonal contrast between near and far elements.')
  }

  if (analysis.shadowClip > 0.05 && analysis.highlightClip > 0.05) {
    feedback.push('Both shadows and highlights are clipping. Shooting in RAW would preserve more dynamic range for recovery.')
  } else if (analysis.symmetry > 0.85) {
    feedback.push('Great use of symmetry — this creates a strong, satisfying visual pattern.')
  }

  return feedback.slice(0, 6)
}

function generateSummary(scores) {
  const r = scores.overall_rating
  if (r >= 9) return 'An outstanding photograph with exceptional quality across all dimensions. Very few improvements needed.'
  if (r >= 7) return 'A strong image with good fundamentals. Minor refinements in a few areas could push it to the next level.'
  if (r >= 5) return 'A decent shot with room for improvement. Focus on the feedback areas to elevate your photography.'
  if (r >= 3) return 'This image has some issues that need attention. Work on the fundamentals of exposure, composition, and focus.'
  return 'This image needs significant work. Review the feedback and practice the basics of photography technique.'
}

async function analyzeFile(file) {
  const img = await loadImage(file)
  const pixels = getPixelData(img)
  const analysis = analyzeImage(pixels)
  const scores = scoreFromAnalysis(analysis)
  const feedback = generateFeedback(scores, analysis)
  const summary = generateSummary(scores)
  URL.revokeObjectURL(img.src)
  return { ...scores, feedback, summary, _analysis: analysis }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function critiquePhoto(file) {
  const [result] = await Promise.all([analyzeFile(file), delay(1500)])
  const { _analysis, ...critique } = result
  return critique
}

export async function comparePhotos(fileA, fileB) {
  const [resultA, resultB] = await Promise.all([
    analyzeFile(fileA),
    analyzeFile(fileB),
    delay(2000),
  ])

  const { _analysis: _a, ...critiqueA } = resultA
  const { _analysis: _b, ...critiqueB } = resultB

  const winner = critiqueA.overall_rating >= critiqueB.overall_rating ? 'A' : 'B'
  const winning = winner === 'A' ? critiqueA : critiqueB
  const losing = winner === 'A' ? critiqueB : critiqueA

  const reasons = []
  if (winning.composition > losing.composition) reasons.push('better composition')
  if (winning.lighting > losing.lighting) reasons.push('superior lighting')
  if (winning.color_balance > losing.color_balance) reasons.push('more balanced colors')
  if (winning.technical_quality > losing.technical_quality) reasons.push('higher technical quality')
  if (winning.artistic_quality > losing.artistic_quality) reasons.push('stronger artistic vision')
  if (reasons.length === 0) reasons.push('overall stronger execution')

  const reason = `Image ${winner} wins with ${reasons.join(' and ')}, scoring ${winning.overall_rating}/10 vs ${losing.overall_rating}/10.`

  return { image_a: critiqueA, image_b: critiqueB, winner, reason }
}
