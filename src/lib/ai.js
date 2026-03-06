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

  return {
    avgBrightness, contrast, avgSaturation, shadowClip, highlightClip,
    warmth, sharpness, thirdsScore, colorVariety, symmetry,
    aspectRatio: width / height,
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

  const overall = Math.round((composition + lighting + colorBalance + technical) / 4)

  return { overall_rating: overall, composition, lighting, color_balance: colorBalance, technical_quality: technical }
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

  if (analysis.shadowClip > 0.05 && analysis.highlightClip > 0.05) {
    feedback.push('Both shadows and highlights are clipping. Shooting in RAW would preserve more dynamic range for recovery.')
  } else if (analysis.colorVariety < 0.15) {
    feedback.push('The color palette is very limited. While minimalism can be powerful, consider if more color contrast would strengthen the image.')
  } else if (analysis.symmetry > 0.85) {
    feedback.push('Great use of symmetry — this creates a strong, satisfying visual pattern.')
  }

  return feedback.slice(0, 5)
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
  if (reasons.length === 0) reasons.push('overall stronger execution')

  const reason = `Image ${winner} wins with ${reasons.join(' and ')}, scoring ${winning.overall_rating}/10 vs ${losing.overall_rating}/10.`

  return { image_a: critiqueA, image_b: critiqueB, winner, reason }
}
