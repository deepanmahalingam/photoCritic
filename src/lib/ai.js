// Fully client-side image analysis engine — NO API keys needed.
// 1. Pixel analysis → numerical scores
// 2. TensorFlow.js MobileNet → scene/object classification
// 3. TensorFlow.js COCO-SSD → object detection with positions
// 4. Template engine → content-aware descriptive feedback

import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

// ============================================================
// MODEL LOADING (cached — loads once, reused across analyses)
// ============================================================

let mobilenetModel = null
let cocoModel = null
let modelsLoading = null

function loadModels() {
  if (modelsLoading) return modelsLoading
  modelsLoading = Promise.all([
    mobilenet.load({ version: 2, alpha: 0.5 }),
    cocoSsd.load({ base: 'lite_mobilenet_v2' }),
  ]).then(([mnet, coco]) => {
    mobilenetModel = mnet
    cocoModel = coco
    return { mobilenetModel, cocoModel }
  })
  return modelsLoading
}

// Pre-warm models on import
loadModels()

// ============================================================
// SCENE & OBJECT CLASSIFICATION
// ============================================================

const SCENE_MAP = {
  // Nature & Landscape
  'lakeside': 'landscape', 'valley': 'landscape', 'cliff': 'landscape', 'alp': 'landscape',
  'mountain': 'landscape', 'volcano': 'landscape', 'seashore': 'landscape', 'beach': 'landscape',
  'promontory': 'landscape', 'sandbar': 'landscape', 'coral reef': 'nature',
  'meadow': 'nature', 'garden': 'nature', 'flower': 'nature', 'daisy': 'nature',
  'sunflower': 'nature', 'tree': 'nature', 'forest': 'nature', 'jungle': 'nature',
  'mushroom': 'nature', 'hay': 'nature',

  // Sky & Weather
  'sky': 'sky', 'sunset': 'sky', 'cloud': 'sky', 'rainbow': 'sky',

  // Architecture
  'church': 'architecture', 'castle': 'architecture', 'palace': 'architecture',
  'monastery': 'architecture', 'mosque': 'architecture', 'dome': 'architecture',
  'tower': 'architecture', 'bridge': 'architecture', 'lighthouse': 'architecture',
  'barn': 'architecture', 'greenhouse': 'architecture', 'cinema': 'architecture',
  'library': 'architecture', 'restaurant': 'architecture', 'bakery': 'architecture',
  'triumphal arch': 'architecture', 'beacon': 'architecture', 'stupa': 'architecture',

  // Urban & Street
  'street': 'street', 'parking': 'street', 'traffic light': 'street',
  'cab': 'street', 'taxi': 'street', 'trolleybus': 'street', 'minibus': 'street',
  'streetcar': 'street', 'fire engine': 'street', 'ambulance': 'street',
  'moving van': 'street', 'police van': 'street',

  // People & Portraits
  'face': 'portrait', 'wig': 'portrait', 'mask': 'portrait',
  'jean': 'portrait', 'suit': 'portrait', 'gown': 'portrait',

  // Animals
  'dog': 'animal', 'cat': 'animal', 'bird': 'animal', 'fish': 'animal',
  'horse': 'animal', 'elephant': 'animal', 'bear': 'animal', 'zebra': 'animal',
  'tiger': 'animal', 'lion': 'animal', 'monkey': 'animal', 'rabbit': 'animal',
  'butterfly': 'animal', 'bee': 'animal', 'spider': 'animal', 'snake': 'animal',
  'goldfish': 'animal', 'hamster': 'animal', 'poodle': 'animal', 'retriever': 'animal',
  'shepherd': 'animal', 'tabby': 'animal', 'Persian cat': 'animal', 'Siamese': 'animal',
  'hen': 'animal', 'rooster': 'animal', 'goose': 'animal', 'flamingo': 'animal',
  'pelican': 'animal', 'hummingbird': 'animal', 'jay': 'animal', 'robin': 'animal',
  'toucan': 'animal', 'peacock': 'animal', 'parrot': 'animal', 'macaw': 'animal',

  // Food
  'pizza': 'food', 'cheeseburger': 'food', 'hotdog': 'food', 'pretzel': 'food',
  'espresso': 'food', 'cup': 'food', 'plate': 'food', 'bowl': 'food',
  'ice cream': 'food', 'chocolate': 'food', 'fruit': 'food', 'banana': 'food',
  'orange': 'food', 'lemon': 'food', 'pineapple': 'food', 'strawberry': 'food',
  'pomegranate': 'food', 'bagel': 'food', 'meatloaf': 'food', 'burrito': 'food',
  'carbonara': 'food', 'trifle': 'food', 'menu': 'food',

  // Vehicles
  'car': 'vehicle', 'sports car': 'vehicle', 'convertible': 'vehicle',
  'racer': 'vehicle', 'jeep': 'vehicle', 'limousine': 'vehicle',
  'pickup': 'vehicle', 'truck': 'vehicle', 'trailer truck': 'vehicle',
  'motorcycle': 'vehicle', 'scooter': 'vehicle', 'bicycle': 'vehicle',
  'boat': 'vehicle', 'sailboat': 'vehicle', 'canoe': 'vehicle', 'speedboat': 'vehicle',
  'yacht': 'vehicle', 'gondola': 'vehicle', 'aircraft': 'vehicle', 'airliner': 'vehicle',
  'warplane': 'vehicle',

  // Interior
  'desk': 'interior', 'chair': 'interior', 'bookcase': 'interior', 'table': 'interior',
  'lamp': 'interior', 'monitor': 'interior', 'laptop': 'interior', 'keyboard': 'interior',
  'television': 'interior', 'refrigerator': 'interior', 'stove': 'interior',
  'dining table': 'interior', 'bathtub': 'interior', 'toilet': 'interior',
  'window shade': 'interior', 'curtain': 'interior',
}

function categorizeScene(predictions) {
  const categories = {}
  const topLabels = []

  for (const pred of predictions.slice(0, 5)) {
    const label = pred.className.toLowerCase()
    topLabels.push({ name: pred.className, prob: pred.probability })

    for (const [keyword, scene] of Object.entries(SCENE_MAP)) {
      if (label.includes(keyword.toLowerCase())) {
        categories[scene] = (categories[scene] || 0) + pred.probability
        break
      }
    }
  }

  // Find dominant scene type
  let bestScene = 'general'
  let bestScore = 0
  for (const [scene, score] of Object.entries(categories)) {
    if (score > bestScore) { bestScene = scene; bestScore = score }
  }

  return { sceneType: bestScene, labels: topLabels }
}

function describeObjects(detections) {
  if (!detections.length) return { objects: [], positions: [] }

  const objects = []
  const positions = []

  for (const det of detections) {
    const [x, y, w, h] = det.bbox
    const cx = x + w / 2
    const cy = y + h / 2

    let position = 'center'
    if (cx < 0.33) position = cy < 0.33 ? 'top-left' : cy > 0.66 ? 'bottom-left' : 'left'
    else if (cx > 0.66) position = cy < 0.33 ? 'top-right' : cy > 0.66 ? 'bottom-right' : 'right'
    else position = cy < 0.33 ? 'top' : cy > 0.66 ? 'bottom' : 'center'

    objects.push(det.class)
    positions.push({ name: det.class, position, score: det.score, relativeSize: (w * h) })
  }

  return { objects: [...new Set(objects)], positions }
}

// ============================================================
// PIXEL ANALYSIS (scores)
// ============================================================

function loadImageEl(file) {
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
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), width: canvas.width, height: canvas.height }
}

function analyzePixels(pixels) {
  const { data, width, height } = pixels
  const d = data.data
  const N = width * height

  let bSum = 0
  const bArr = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const idx = i * 4
    bArr[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]
    bSum += bArr[i]
  }
  const avgB = bSum / N

  let cSum = 0
  for (let i = 0; i < N; i++) { const diff = bArr[i] - avgB; cSum += diff * diff }
  const contrast = Math.sqrt(cSum / N)

  let sSum = 0
  for (let i = 0; i < N; i++) {
    const idx = i * 4
    const max = Math.max(d[idx], d[idx + 1], d[idx + 2]), min = Math.min(d[idx], d[idx + 1], d[idx + 2])
    sSum += max === 0 ? 0 : (max - min) / max
  }
  const avgSat = sSum / N

  const hist = new Array(256).fill(0)
  for (let i = 0; i < N; i++) hist[Math.round(bArr[i])]++
  const shadowClip = hist.slice(0, 10).reduce((a, b) => a + b, 0) / N
  const highlightClip = hist.slice(246).reduce((a, b) => a + b, 0) / N

  let rT = 0, bT = 0
  for (let i = 0; i < N; i++) { const idx = i * 4; rT += d[idx]; bT += d[idx + 2] }
  const warmth = rT / (bT || 1)

  let shSum = 0, shC = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    const lap = -4 * bArr[i] + bArr[i - 1] + bArr[i + 1] + bArr[i - width] + bArr[i + width]
    shSum += lap * lap; shC++
  }
  const sharpness = Math.sqrt(shSum / shC)

  const tw = width / 3, th = height / 3
  const pp = [[tw, th], [2 * tw, th], [tw, 2 * th], [2 * tw, 2 * th]]
  const rg = Math.max(10, Math.round(Math.min(width, height) * 0.08))
  let iT = 0, tI = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    const edge = Math.abs(bArr[i] - bArr[i - 1]) + Math.abs(bArr[i] - bArr[i - width])
    tI += edge
    for (const [px, py] of pp) if (Math.abs(x - px) < rg && Math.abs(y - py) < rg) { iT += edge; break }
  }
  const thirds = tI > 0 ? iT / tI : 0

  const hueBins = new Set()
  for (let i = 0; i < N; i += 3) {
    const idx = i * 4, r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 20) continue
    let h = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hueBins.add(Math.floor(h / 30))
  }
  const colorVar = hueBins.size / 12

  let symD = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < Math.floor(width / 2); x++)
    symD += Math.abs(bArr[y * width + x] - bArr[y * width + (width - 1 - x)])
  const symmetry = 1 - symD / (N * 128)

  // Artistic
  const eMap = new Float32Array(N)
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    eMap[i] = Math.abs(bArr[i] - bArr[i - 1]) + Math.abs(bArr[i] - bArr[i + 1]) +
              Math.abs(bArr[i] - bArr[i - width]) + Math.abs(bArr[i] - bArr[i + width])
  }
  let eMax = 0
  for (let i = 0; i < N; i++) if (eMap[i] > eMax) eMax = eMap[i]
  let quiet = 0
  for (let i = 0; i < N; i++) if (eMap[i] < eMax * 0.1) quiet++
  const negSpace = quiet / N

  const bSz = Math.max(8, Math.round(Math.min(width, height) * 0.06))
  let maxBE = 0, totE = 0
  for (let by = 0; by < height - bSz; by += Math.ceil(bSz / 2))
    for (let bx = 0; bx < width - bSz; bx += Math.ceil(bSz / 2)) {
      let bs = 0
      for (let dy = 0; dy < bSz; dy++) for (let dx = 0; dx < bSz; dx++) bs += eMap[(by + dy) * width + (bx + dx)]
      if (bs > maxBE) maxBE = bs; totE += bs
    }
  const focal = totE > 0 ? maxBE / (totE * 0.15) : 0

  let fB = 255, lB = 0
  for (let i = 0; i < 256; i++) if (hist[i] > N * 0.001) { if (i < fB) fB = i; if (i > lB) lB = i }
  const tonalRange = (lB - fB) / 255

  const hHist = new Array(12).fill(0)
  for (let i = 0; i < N; i += 2) {
    const idx = i * 4, r = d[idx], g = d[idx + 1], b = d[idx + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 25) continue
    let h = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
    hHist[Math.floor(h / 30)]++
  }
  const hT = hHist.reduce((a, b) => a + b, 0)
  const hF = hHist.map(v => hT > 0 ? v / hT : 0)
  const domH = hF.map((f, i) => ({ idx: i, frac: f })).filter(h => h.frac > 0.1)
  let harmony = 0
  if (domH.length === 1) harmony = 0.7
  else if (domH.length >= 2) {
    for (let i = 0; i < domH.length; i++) for (let j = i + 1; j < domH.length; j++) {
      const g = Math.min(Math.abs(domH[i].idx - domH[j].idx), 12 - Math.abs(domH[i].idx - domH[j].idx))
      harmony += g <= 2 ? 0.4 : g >= 5 && g <= 7 ? 0.5 : g === 4 || g === 8 ? 0.35 : 0.15
    }
    harmony = Math.min(1, harmony)
  }

  const cx = width / 2, cy = height / 2, md = Math.sqrt(cx * cx + cy * cy)
  let iB = 0, oB = 0, iC = 0, oC = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / md
    const l = bArr[y * width + x]
    if (dist < 0.35) { iB += l; iC++ } else if (dist > 0.65) { oB += l; oC++ }
  }
  const depthG = Math.abs((iC > 0 ? iB / iC : 128) - (oC > 0 ? oB / oC : 128)) / 128

  let eM = 0, eC = 0
  for (let i = 0; i < N; i++) if (eMap[i] > 0) { eM += eMap[i]; eC++ }
  eM = eC > 0 ? eM / eC : 0
  let eV = 0
  for (let i = 0; i < N; i++) if (eMap[i] > 0) { const dd = eMap[i] - eM; eV += dd * dd }
  const texComp = eC > 0 ? Math.sqrt(eV / eC) : 0

  // Dominant color name
  const colorNames = ['red', 'orange', 'yellow', 'chartreuse', 'green', 'spring green', 'cyan', 'azure', 'blue', 'violet', 'magenta', 'rose']
  const domColorIdx = hHist.indexOf(Math.max(...hHist))
  const dominantColor = hT > N * 0.05 ? colorNames[domColorIdx] : 'neutral'

  return {
    avgBrightness: avgB, contrast, avgSaturation: avgSat, shadowClip, highlightClip,
    warmth, sharpness, thirds, colorVar, symmetry,
    aspectRatio: width / height,
    negSpace, focal, tonalRange, harmony, depthG, texComp,
    dominantColor,
  }
}

function computeRawScores(a) {
  let comp = 5
  comp += Math.min(2.5, a.thirds * 25)
  comp += a.symmetry > 0.7 ? 1 : a.symmetry > 0.5 ? 0.5 : 0
  const gr = [16 / 9, 4 / 3, 3 / 2, 1, 2 / 3, 3 / 4]
  comp += Math.min(...gr.map(r => Math.abs(a.aspectRatio - r))) < 0.1 ? 0.5 : 0
  comp = Math.max(1, Math.min(10, comp))

  let light = 5
  light += (1 - Math.abs(a.avgBrightness - 130) / 130) * 2
  light += Math.min(1, a.contrast / 70) * 2
  light -= a.shadowClip * 8 + a.highlightClip * 8
  light = Math.max(1, Math.min(10, light))

  let color = 5
  color += (1 - Math.min(1, Math.abs(a.avgSaturation - 0.4) / 0.4)) * 2
  color += (1 - Math.min(1, Math.abs(a.warmth - 1.1) / 1.1))
  color += a.colorVar * 1.5
  color = Math.max(1, Math.min(10, color))

  let tech = 5
  tech += Math.min(1, a.sharpness / 25) * 3
  if (a.avgBrightness < 40 || a.avgBrightness > 230) tech -= 2
  tech -= (a.shadowClip + a.highlightClip) * 4
  tech = Math.max(1, Math.min(10, tech))

  let art = 4
  art += (1 - Math.abs(a.negSpace - 0.45) / 0.45) * 1.5
  art += Math.min(2, a.focal * 1.2)
  art += a.tonalRange * 1.5
  art += a.harmony * 1.5
  art += Math.min(1, a.depthG * 4)
  art += (1 - Math.abs(Math.min(1, a.texComp / 30) - 0.5) * 2)
  art = Math.max(1, Math.min(10, art))

  const overall = (comp + light + color + tech + art) / 5
  return { overall_rating: overall, composition: comp, lighting: light, color_balance: color, technical_quality: tech, artistic_quality: art }
}

// Add AI-model bonus: scene confidence, object count, and detection quality
function applyModelBonus(rawScores, classifications, detections) {
  const topConf = classifications[0]?.probability || 0
  const objCount = detections.length
  const avgObjConf = objCount > 0 ? detections.reduce((s, d) => s + d.score, 0) / objCount : 0

  // Clear subject = sharper content = better composition & artistic merit
  const compBonus = Math.min(0.5, avgObjConf * 0.4 + (objCount > 0 ? 0.1 : 0))
  const artBonus = Math.min(0.6, topConf * 0.3 + (objCount >= 2 ? 0.15 : 0) + (avgObjConf > 0.6 ? 0.15 : 0))
  const techBonus = Math.min(0.4, avgObjConf * 0.3 + (topConf > 0.3 ? 0.1 : 0))

  const s = { ...rawScores }
  s.composition = Math.max(1, Math.min(10, s.composition + compBonus))
  s.artistic_quality = Math.max(1, Math.min(10, s.artistic_quality + artBonus))
  s.technical_quality = Math.max(1, Math.min(10, s.technical_quality + techBonus))
  s.overall_rating = (s.composition + s.lighting + s.color_balance + s.technical_quality + s.artistic_quality) / 5
  return s
}

// Round scores for display, keep raw precision internally
function roundScores(raw) {
  return {
    overall_rating: Math.round(raw.overall_rating),
    composition: Math.round(raw.composition),
    lighting: Math.round(raw.lighting),
    color_balance: Math.round(raw.color_balance),
    technical_quality: Math.round(raw.technical_quality),
    artistic_quality: Math.round(raw.artistic_quality),
  }
}

function computeScores(a) {
  return roundScores(computeRawScores(a))
}

// ============================================================
// SHARED HELPERS
// ============================================================

function deriveWarmCool(analysis) {
  return analysis.warmth > 1.15 ? 'warm' : analysis.warmth < 0.9 ? 'cool' : 'neutral'
}

function deriveMood(analysis) {
  const warmCool = deriveWarmCool(analysis)
  if (warmCool === 'warm' && analysis.avgBrightness > 130) return 'inviting and nostalgic'
  if (warmCool === 'warm') return 'intimate and atmospheric'
  if (warmCool === 'cool' && analysis.avgBrightness > 130) return 'fresh and contemporary'
  if (warmCool === 'cool') return 'moody and contemplative'
  if (analysis.avgBrightness > 170) return 'airy and ethereal'
  if (analysis.avgBrightness < 70) return 'dramatic and cinematic'
  return 'balanced and polished'
}


// ============================================================
// CONTENT-AWARE FEEDBACK GENERATOR
// ============================================================

function generateFeedback(scores, analysis, sceneInfo, objectInfo) {
  const feedback = []
  const { sceneType, labels } = sceneInfo
  const { objects, positions } = objectInfo

  const topLabel = labels[0]?.name || 'subject'
  const warmCool = deriveWarmCool(analysis)
  const brightDesc = analysis.avgBrightness > 170 ? 'bright' : analysis.avgBrightness < 70 ? 'dark, moody' : 'well-balanced'
  const sharpDesc = analysis.sharpness > 20 ? 'sharp and detailed' : analysis.sharpness > 10 ? 'reasonably sharp' : 'soft'
  const colorDesc = analysis.dominantColor !== 'neutral' ? `${analysis.dominantColor} tones` : 'neutral tones'

  // 1. Scene description + what works well
  const sceneDescriptions = {
    landscape: `This landscape scene captures ${topLabel.toLowerCase()} with ${brightDesc} ${warmCool} tones. The ${colorDesc} create ${warmCool === 'warm' ? 'an inviting, golden atmosphere' : warmCool === 'cool' ? 'a calm, serene atmosphere' : 'a balanced, natural feel'}.`,
    nature: `A nature shot featuring ${topLabel.toLowerCase()} with ${brightDesc} lighting. The natural ${colorDesc} and ${sharpDesc} detail bring out the organic textures and forms beautifully.`,
    architecture: `An architectural photograph showcasing ${topLabel.toLowerCase()}. The ${warmCool} light enhances the structural textures and material surfaces, giving the building ${warmCool === 'warm' ? 'a golden, inviting character' : 'a crisp, defined look'}.`,
    street: `A street scene capturing ${topLabel.toLowerCase()} with ${brightDesc} ${warmCool} tones. The urban elements and ${sharpDesc} detail create a sense of place and atmosphere.`,
    portrait: `A portrait-style shot featuring ${topLabel.toLowerCase()}. The ${brightDesc} lighting and ${warmCool} color temperature ${warmCool === 'warm' ? 'flatter the subject with a soft glow' : 'create a clean, modern look'}.`,
    animal: `A captivating animal shot featuring ${topLabel.toLowerCase()}. The ${sharpDesc} focus captures the subject's details and character, while the ${warmCool} ${colorDesc} set the mood.`,
    food: `A food photograph presenting ${topLabel.toLowerCase()} with ${brightDesc} lighting. The ${warmCool} ${colorDesc} ${warmCool === 'warm' ? 'make the dish look appetizing and inviting' : 'give the dish a clean, editorial look'}.`,
    vehicle: `A shot featuring ${topLabel.toLowerCase()} with ${brightDesc} ${warmCool} lighting. The ${sharpDesc} detail captures the lines and surfaces with ${analysis.contrast > 50 ? 'strong contrast that emphasizes form' : 'smooth tonal transitions'}.`,
    interior: `An interior scene showing ${topLabel.toLowerCase()} with ${brightDesc} ${warmCool} light. The ${colorDesc} and ${analysis.contrast > 50 ? 'defined shadows add dimension' : 'soft tones create a cozy ambiance'}.`,
    sky: `A sky/atmospheric shot capturing ${topLabel.toLowerCase()} with ${brightDesc} tones. The ${warmCool} ${colorDesc} create ${warmCool === 'warm' ? 'a dramatic, golden hour atmosphere' : 'a serene, expansive feeling'}.`,
    general: `This photograph features ${topLabel.toLowerCase()} with ${brightDesc} ${warmCool} tones. The ${colorDesc} and ${sharpDesc} detail ${scores.overall_rating >= 7 ? 'work together effectively' : 'set the foundation for the image'}.`,
  }
  feedback.push(sceneDescriptions[sceneType] || sceneDescriptions.general)

  // 2. Composition feedback referencing detected objects
  if (objects.length > 0) {
    const mainObj = positions[0]
    const otherObjs = objects.slice(1, 3)
    if (scores.composition >= 7) {
      feedback.push(`The ${mainObj.name} is well-positioned ${mainObj.position === 'center' ? 'at the center of the frame' : `toward the ${mainObj.position}`}, creating a strong focal point.${otherObjs.length ? ` The ${otherObjs.join(' and ')} in the frame add${otherObjs.length === 1 ? 's' : ''} depth and context to the scene.` : ''}`)
    } else {
      feedback.push(`The ${mainObj.name} sits ${mainObj.position === 'center' ? 'dead center' : `in the ${mainObj.position} area`} — try repositioning it along the rule-of-thirds gridlines for a more dynamic feel.${otherObjs.length ? ` The ${otherObjs.join(' and ')} could be arranged to lead the viewer's eye through the composition.` : ''}`)
    }
  } else {
    feedback.push(scores.composition >= 7
      ? `The framing creates a balanced composition with visual interest distributed effectively across the frame. ${analysis.symmetry > 0.8 ? 'The strong symmetry adds a pleasing, ordered quality.' : 'The asymmetric balance adds a natural, dynamic energy.'}`
      : `Consider reframing to place the main subject along the rule-of-thirds intersection points. ${analysis.negSpace > 0.6 ? 'There is a lot of open space — use it intentionally to create breathing room or tension.' : 'The frame feels busy — simplifying could strengthen the impact.'}`)
  }

  // 3. Lighting feedback with scene context
  if (analysis.avgBrightness < 60) {
    feedback.push(`The ${sceneType === 'portrait' ? 'subject is underlit' : 'scene is quite dark'} — the shadows are heavy and detail is being lost in the darker areas. ${sceneType === 'landscape' || sceneType === 'sky' ? 'Shooting during golden hour or using a graduated filter could help balance the exposure.' : 'Consider using fill light or opening up the exposure to reveal more detail.'}`)
  } else if (analysis.highlightClip > 0.08) {
    feedback.push(`The ${sceneType === 'sky' ? 'sky is blown out — a graduated ND filter or HDR technique' : 'highlights are clipping — reducing exposure slightly'} would help recover detail in the brightest areas while preserving the ${warmCool} mood.`)
  } else if (scores.lighting >= 7) {
    feedback.push(`The lighting is handled beautifully — the ${warmCool} quality ${sceneType === 'architecture' ? 'rakes across the surfaces, revealing texture and dimension' : sceneType === 'portrait' ? 'wraps around the subject softly' : 'creates a pleasing interplay of highlights and shadows'} with a ${analysis.contrast > 50 ? 'rich, contrasty feel' : 'gentle, even distribution'}.`)
  } else {
    feedback.push(`The lighting is functional but could be more intentional. ${analysis.contrast < 30 ? 'Adding more directional light or shooting at a different time of day would create depth through shadows.' : 'The contrast is present but the light direction doesn\'t emphasize the main subject enough.'}`)
  }

  // 4. What could be improved
  const improvements = []
  if (analysis.sharpness < 10) improvements.push(`the ${objects[0] || 'subject'} appears soft — a faster shutter speed or careful focusing would improve crispness`)
  if (analysis.shadowClip > 0.06) improvements.push('some shadow detail is being crushed in the darker regions')
  if (analysis.avgSaturation > 0.65) improvements.push('the colors feel oversaturated — dialing back slightly would look more natural')
  if (analysis.avgSaturation < 0.12) improvements.push('the colors are very desaturated — if not intentional, adding subtle warmth or vibrancy could help')
  if (analysis.negSpace > 0.7) improvements.push('there is a lot of empty space that doesn\'t seem to serve a compositional purpose')
  if (analysis.negSpace < 0.15) improvements.push('the frame feels very crowded — stepping back or simplifying the scene could help')
  if (analysis.harmony < 0.3 && analysis.dominantColor !== 'neutral') improvements.push(`the color palette feels somewhat scattered — working with complementary ${analysis.dominantColor} tones would create more visual unity`)

  if (improvements.length > 0) {
    feedback.push(`To improve this shot: ${improvements.slice(0, 2).join(', and ')}. ${improvements.length > 2 ? 'Also, ' + improvements[2] + '.' : ''}`)
  } else {
    feedback.push('Very few technical issues to note — this is a well-executed photograph. Minor adjustments to taste would be the only refinement needed.')
  }

  // 5. Artistic impression / mood
  const moodDesc = deriveMood(analysis)

  feedback.push(`Overall, the image has a ${moodDesc} quality. ${scores.artistic_quality >= 7 ? 'There is a clear artistic intention and the visual elements come together cohesively — it feels like a deliberate, finished piece.' : scores.artistic_quality >= 5 ? 'The foundations are solid — refining the composition and light could elevate this from a good shot to a memorable one.' : 'With more intentional framing and light, this scene has potential to become a much stronger image.'}`)

  return feedback
}

function generateSummary(scores, analysis, sceneInfo, objectInfo) {
  const topLabel = sceneInfo.labels[0]?.name || 'subject'
  const wc = deriveWarmCool(analysis)
  const warmCool = wc === 'neutral' ? 'naturally lit' : wc
  const objs = objectInfo.objects.slice(0, 2)
  const objStr = objs.length ? ` featuring ${objs.join(' and ')}` : ''
  const r = scores.overall_rating

  if (r >= 8) return `A strong ${sceneInfo.sceneType} photograph${objStr} with ${warmCool} tones and confident execution. The lighting, color, and composition work together to create a polished, engaging image.`
  if (r >= 6) return `A solid ${sceneInfo.sceneType} shot${objStr} with ${warmCool} tones. The fundamentals are in place — targeted improvements in ${scores.lighting < scores.composition ? 'lighting' : 'composition'} and detail would elevate it further.`
  if (r >= 4) return `A ${sceneInfo.sceneType} photograph${objStr} with ${warmCool} tones that shows potential. Addressing the exposure, sharpness, and compositional balance would significantly strengthen the result.`
  return `A ${sceneInfo.sceneType} capture${objStr} that needs work on core fundamentals. Focus on exposure, sharp focus, and cleaner composition to build a stronger foundation.`
}

// ============================================================
// SMART CAPTION BANK — pre-written captions selected by context
// No API key needed. Detection data is used for SELECTION only.
// ============================================================

const OBJECT_CAPTIONS = {
  person: ['Caught between moments', 'Main character energy', 'Living proof that good times exist', 'Not posing, just existing beautifully', 'Some stories are best told without words'],
  dog: ['Who rescued who?', 'My four-legged therapist at work', 'Pawsitively obsessed', 'Every dog has its day \u2014 today is theirs', 'The goodest boy in any timeline'],
  cat: ['Purrfection in its natural habitat', 'Attitude level: feline', 'Nine lives, not a single care', 'The internet was built for this', 'Whiskers and wisdom'],
  bird: ['Wings weren\u2019t made for cages', 'Free as the sky allows', 'Nature\u2019s little soprano', 'Feathered and fearless', 'Born to fly'],
  car: ['Life in the fast lane', 'Built for the road less traveled', 'Chasing horizons on four wheels', 'The journey is the destination', 'Ride or die'],
  truck: ['Life in the fast lane', 'Built for the road less traveled', 'Heavy metal on the highway', 'The journey is the destination', 'Miles to go'],
  bus: ['Life in the fast lane', 'Next stop: somewhere beautiful', 'The journey is the destination', 'Rolling through', 'Along for the ride'],
  motorcycle: ['Two wheels, endless freedom', 'Born to ride', 'Wind in the soul', 'Throttle therapy', 'Ride or die'],
  bicycle: ['Life is a beautiful ride', 'Two wheels, zero worries', 'Pedaling through paradise', 'The slow lane is underrated', 'Freedom has two wheels'],
  horse: ['Unbridled beauty', 'Born to run wild', 'Grace on four legs', 'Where the wild things are', 'Hoofbeats and heartbeats'],
  bottle: ['Sip happens', 'Cheers to the little things', 'Brewing something beautiful', 'Pour decisions make the best stories', 'Fill your cup with what matters'],
  'wine glass': ['Sip happens', 'Cheers to the little things', 'Wine not?', 'Pour decisions make the best stories', 'Aged to perfection'],
  cup: ['But first, coffee', 'Brewing something beautiful', 'Cheers to the little things', 'Fill your cup with what matters', 'Warm hands, warm heart'],
  pizza: ['Feed your soul', 'Life is short \u2014 eat the good stuff', 'Calories don\u2019t count when the vibes are right', 'A slice of heaven', 'Comfort in every bite'],
  sandwich: ['Feed your soul', 'Life is short \u2014 eat the good stuff', 'Stacked with love', 'A balanced diet is food in both hands', 'Comfort in every bite'],
  donut: ['Feed your soul', 'Donut worry, be happy', 'Life is short \u2014 eat the good stuff', 'Sweet on you', 'Hole lot of happiness'],
  cake: ['Feed your soul', 'Life is sweet', 'Having my cake and eating it too', 'Layers of happiness', 'Sweet moments'],
  'hot dog': ['Feed your soul', 'Relish the moment', 'Life is short \u2014 eat the good stuff', 'Comfort in every bite', 'Simple pleasures'],
  banana: ['Fresh picked and living', 'Nature\u2019s candy', 'The simple things hit different', 'Organic vibes only', 'Straight from the source'],
  apple: ['Fresh picked and living', 'Nature\u2019s candy', 'The simple things hit different', 'Organic vibes only', 'An apple a day'],
  orange: ['Fresh picked and living', 'Nature\u2019s candy', 'Squeeze the day', 'Organic vibes only', 'Vitamin sea \u2014 I mean C'],
  broccoli: ['Eat your greens', 'Green and thriving', 'Good food, good mood', 'Rooted in wellness', 'Farm fresh feels'],
  carrot: ['Eat your greens', 'Orange you glad?', 'Good food, good mood', 'Rooted in wellness', 'Farm fresh feels'],
  'potted plant': ['Growing where I\u2019m planted', 'Rooted in good vibes', 'Bloom where you are', 'Green is the new everything', 'Plant parent energy'],
  book: ['Between the lines', 'Lost in a good story', 'Pages over screens', 'The best journeys start with a page', 'Ink and imagination'],
  laptop: ['Pixels and possibilities', 'Screen time worth having', 'Creating from anywhere', 'Digital dreams', 'Work hard, scroll harder'],
  tv: ['Screen time worth having', 'Binge-worthy moments', 'Pixels and chill', 'Digital vibes', 'Streaming and dreaming'],
  keyboard: ['Pixels and possibilities', 'Type your own story', 'Creating from anywhere', 'Digital vibes', 'Key to happiness'],
  couch: ['Comfort zone activated', 'Home is where the couch is', 'Rest is productive too', 'Living room living', 'Cozy never goes out of style'],
  bed: ['Comfort zone activated', 'Dream headquarters', 'Rest is productive too', 'Pillow talk', 'Cozy never goes out of style'],
  chair: ['Take a seat, stay awhile', 'Home is where the heart is', 'Comfort zone activated', 'Living my best life', 'Sit back and enjoy'],
  umbrella: ['Dancing in the rain', 'Storm chaser', 'Every cloud has a silver lining', 'Rain check accepted', 'Umbrella weather is my weather'],
  clock: ['Time well spent', 'Every second counts', 'Making time for what matters', 'Clocking good vibes', 'Time flies when you\u2019re living'],
  vase: ['Bloom where you are', 'Fresh flowers, fresh start', 'Petal power', 'Arranged with love', 'Life in full bloom'],
  teddy_bear: ['Soft and sentimental', 'Bear hugs only', 'Childhood never really ends', 'Forever cuddly', 'Some things never get old'],
  sports_ball: ['Game on', 'Playing to win', 'Ball is life', 'In my element', 'Nothing but net'],
  kite: ['Letting my dreams fly', 'High spirits', 'Wind beneath my wings', 'Sky\u2019s the limit', 'Soaring high'],
  surfboard: ['Ride the wave', 'Salt life', 'Surf\u2019s up', 'Ocean therapy', 'Catching good vibes'],
  skateboard: ['Roll with it', 'Grinding through life', 'Four wheels and freedom', 'Street style', 'Keep pushing'],
  boat: ['Seas the day', 'Anchored in happiness', 'Smooth sailing ahead', 'Life is better on the water', 'Drifting away'],
  airplane: ['Jet set state of mind', 'Up, up and away', 'Wings over the world', 'Wanderlust activated', 'Above it all'],
  train: ['All aboard', 'On the right track', 'Life\u2019s a journey', 'Next station: adventure', 'Tracks of my life'],
  elephant: ['Gentle giant energy', 'Never forget this moment', 'Majestic in every way', 'Wild and wise', 'Big heart, bigger dreams'],
  bear: ['Bear with me', 'Wild at heart', 'Fierce and free', 'Nature\u2019s powerhouse', 'Untamed beauty'],
  zebra: ['Earning my stripes', 'Black, white, and bold all over', 'Born to stand out', 'Wild patterns', 'Stripe life'],
  giraffe: ['Head and shoulders above the rest', 'Living life on another level', 'Tall tales', 'Reaching for the sky', 'Standing tall'],
  cow: ['Moo-d: content', 'Out standing in the field', 'Simple life, happy life', 'Pasture vibes', 'Udderly beautiful'],
  sheep: ['Following my own path', 'Wool you look at that', 'Counting blessings, not sheep', 'Flock yeah', 'Peaceful pastures'],
  backpack: ['Adventure awaits', 'Packed and ready', 'Wanderlust in a bag', 'Carry your dreams', 'On the go'],
  handbag: ['Carry yourself with confidence', 'Bags of style', 'Got everything I need', 'Accessorize your life', 'Handle with care'],
  tie: ['Dressed to impress', 'Suited and booted', 'Tie game strong', 'Class act', 'Sharp dressed'],
  frisbee: ['Catch this vibe', 'Disc-covering happiness', 'Throwing shade \u2014 the fun kind', 'Play more, worry less', 'Catch me if you can'],
  sink: ['Let that sink in', 'Clean slate', 'Kitchen confidential', 'Sparkling clean', 'Fresh start'],
  refrigerator: ['Cool vibes only', 'Chill mode on', 'What\u2019s cooking good looking', 'Kitchen essentials', 'Keeping it fresh'],
  oven: ['Cooking up something special', 'Heat of the moment', 'Baked with love', 'Something\u2019s brewing', 'Kitchen magic'],
  toilet: ['Throne room selfie', 'Royal flush', 'Behind every great home', 'Porcelain dreams', 'Taking a moment'],
  dining_table: ['Gather around', 'Table for good times', 'Breaking bread', 'The heart of the home', 'Set for happiness'],
  bench: ['Take a seat, enjoy the view', 'Bench press \u2014 just sitting', 'Rest stop for the soul', 'Park life', 'Pause and breathe'],
  fire_hydrant: ['Street style', 'City details', 'Urban jungle', 'Concrete jungle', 'Sidewalk stories'],
  stop_sign: ['Stop and appreciate this', 'Red means ready', 'Pause for effect', 'Stop, look, beautiful', 'Full stop, full appreciation'],
  parking_meter: ['Time is on my side', 'Street views', 'Urban moments', 'City rhythm', 'Parked here for a while'],
  traffic_light: ['Green light go', 'Waiting for the right moment', 'City pulse', 'Urban glow', 'Stop, go, glow'],
  skis: ['Slope style', 'Powder day dreams', 'Ski you later', 'Peak performance', 'Snow much fun'],
  snowboard: ['Shred the gnar', 'Board meeting', 'Snow much fun', 'Riding high', 'Winter wonderland'],
  tennis_racket: ['Love game', 'Serving looks', 'Match point', 'Net gains', 'Court side vibes'],
  scissors: ['Cut above the rest', 'Making the cut', 'Sharp style', 'Crafted with care', 'Precision matters'],
  toothbrush: ['Brush it off', 'Clean start', 'Fresh and ready', 'Morning routine', 'Smile more'],
  hair_drier: ['Blow dry and fly', 'Getting ready vibes', 'Hot air, cool style', 'Prep mode', 'Ready set glow'],
  remote: ['In control', 'Channel your energy', 'Couch commander', 'Binge mode activated', 'Click into it'],
  cell_phone: ['Connected to the moment', 'Ring ring \u2014 adventure calling', 'Screen time', 'Digital life', 'Calling all good vibes'],
  microwave: ['Quick bites', 'Heating up', 'Kitchen shortcuts', 'Fast and fabulous', 'Nuked with love'],
  toaster: ['Toast to the good life', 'Crusty outside, warm inside', 'Morning essentials', 'Toasted perfection', 'Rise and shine'],
  mouse: ['Click into it', 'Point and create', 'Desk vibes', 'Scroll your way', 'Digital life'],
  suitcase: ['Packed for adventure', 'Jet set ready', 'Going places', 'Travel light, live heavy', 'Next destination: happiness'],
  fork: ['Fork yeah', 'Dig in', 'Ready to eat', 'Fork in the road to deliciousness', 'Taste the moment'],
  knife: ['Sharp taste', 'Cut to the chase', 'Kitchen tales', 'Slicing through life', 'Blade runner'],
  spoon: ['Stirring up something good', 'Spoonfuls of happiness', 'Comfort food incoming', 'Dig in', 'Taste the moment'],
  bowl: ['Bowl of goodness', 'Soul food in a bowl', 'Good food, good mood', 'Bowl game strong', 'Wholesome vibes'],
}

const SCENE_MOOD_CAPTIONS = {
  landscape_warm: ['Golden hour never disappoints', 'Where the sky paints itself', 'Horizons dipped in honey'],
  landscape_cool: ['Blue hour whispers', 'Cold air, warm heart', 'Serenity in every shade of blue'],
  landscape_neutral: ['Wide open and waiting', 'The view was worth every step', 'Earth\u2019s screensaver'],
  nature_warm: ['Sunlight through the leaves', 'Nature\u2019s golden gallery', 'Warmth grows wild here'],
  nature_cool: ['Morning dew and quiet moments', 'Cool greens and calm scenes', 'Nature\u2019s quiet side'],
  nature_neutral: ['Touch grass, find peace', 'Wild and free', 'Nature doesn\u2019t hurry'],
  sky_warm: ['Sky on fire', 'Sunset state of mind', 'The sky blushed tonight'],
  sky_cool: ['Endless blue overhead', 'Sky watching, soul charging', 'Painted in shades of blue'],
  sky_neutral: ['Look up more often', 'Cloud gazing hours', 'The sky is today\u2019s canvas'],
  architecture_warm: ['Golden light on old stones', 'History glows at sunset', 'Built to stand, lit to shine'],
  architecture_cool: ['Clean lines, cool tones', 'Modern meets timeless', 'Structure and soul'],
  architecture_neutral: ['Built different', 'Every building has a story', 'Concrete poetry'],
  street_warm: ['City in golden light', 'Urban gold', 'Streets paved with sunset'],
  street_cool: ['Neon nights and city lights', 'Cool streets, warm memories', 'After dark, cities dream'],
  street_neutral: ['Street level perspective', 'Urban rhythm', 'The city never sleeps'],
  portrait_warm: ['Sun-kissed and grateful', 'Golden glow up', 'Warmth looks good on you'],
  portrait_cool: ['Cool tones, warm soul', 'Ice queen energy', 'Blue steel moment'],
  portrait_neutral: ['Just me being me', 'Unapologetically myself', 'Caught in my element'],
  animal_warm: ['Basking in the golden light', 'Warm fur, warmer heart', 'Sun-soaked and content'],
  animal_cool: ['Wild and wonderful', 'Majestic in every light', 'Cool creatures only'],
  animal_neutral: ['Animals make everything better', 'Pure souls', 'Nature\u2019s finest creation'],
  food_warm: ['Comfort food, comfort vibes', 'Warm plates, happy hearts', 'Home-cooked happiness'],
  food_cool: ['Fresh flavors, clean aesthetic', 'Plated to perfection', 'Cool and crisp on the plate'],
  food_neutral: ['Good food, good mood', 'Eat well, live well', 'The art of eating'],
  vehicle_warm: ['Golden mile', 'Sunset drives hit different', 'Chrome and golden light'],
  vehicle_cool: ['Midnight ride', 'Steel blue and rolling', 'Built for the night'],
  vehicle_neutral: ['Open road energy', 'Let\u2019s go somewhere', 'The journey starts now'],
  interior_warm: ['Warm corners and cozy vibes', 'Home is a feeling', 'Golden hour indoors'],
  interior_cool: ['Minimal and intentional', 'Clean space, clear mind', 'Less is more'],
  interior_neutral: ['My happy place', 'Space to breathe', 'Curated living'],
  general_warm: ['Everything the light touches', 'Warm vibes only', 'Bathed in gold'],
  general_cool: ['Cool moment captured', 'Chill vibes documented', 'Blue mood, best mood'],
  general_neutral: ['Moment captured', 'Here and now', 'Simple as it should be'],
}

const MOOD_CAPTIONS = {
  warm_bright: ['Chasing golden moments', 'Let there be light', 'Sunshine state of mind', 'Bright days ahead', 'Glowing from the inside out'],
  warm_dark: ['Candlelit vibes', 'Warmth in the shadows', 'After hours magic', 'Low light, high vibes', 'Amber evenings'],
  cool_bright: ['Crystal clear moments', 'Fresh and fearless', 'Bright side energy', 'Clean and crisp', 'Daylight dreams'],
  cool_dark: ['Moody and magnificent', 'Shadows tell the best stories', 'Dark aesthetic unlocked', 'Night owl hours', 'Into the blue'],
  neutral_bright: ['Light it up', 'Bright ideas only', 'Clarity in every pixel', 'The bright side', 'Good lighting changes everything'],
  neutral_dark: ['Embrace the dark side', 'Contrast is everything', 'Finding beauty in darkness', 'Night mode', 'Low key legendary'],
}

const QUALITY_CAPTIONS = {
  high: ['No filter needed', 'Frame this one', 'This one\u2019s a keeper', 'Gallery wall worthy', 'Shot of the day'],
  medium: ['Work in progress, but make it art', 'Getting better with every click', 'Almost there', 'Good eye, keep shooting'],
  low: ['Every master was once a beginner', 'The best shots are ahead of you', 'Practice makes perfect pixels', 'Keep shooting, keep growing'],
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateCaptions(scores, analysis, sceneInfo, objectInfo) {
  const { sceneType } = sceneInfo
  const { objects } = objectInfo
  const warmCool = deriveWarmCool(analysis)
  const brightness = analysis.avgBrightness > 150 ? 'bright' : analysis.avgBrightness < 80 ? 'dark' : (warmCool === 'neutral' ? 'bright' : '')

  // Collect candidates with layer tags and priority scores
  const candidates = []

  // Layer 1: Object-specific (score 3) — most relevant
  for (const obj of objects) {
    const key = obj.replace(/ /g, '_')
    const pool = OBJECT_CAPTIONS[key] || OBJECT_CAPTIONS[obj]
    if (pool) {
      for (const text of pool) candidates.push({ text, score: 3, layer: 'object' })
    }
  }

  // Layer 2: Scene + mood (score 2)
  const sceneMoodKey = `${sceneType}_${warmCool}`
  const sceneMoodPool = SCENE_MOOD_CAPTIONS[sceneMoodKey]
  if (sceneMoodPool) {
    for (const text of sceneMoodPool) candidates.push({ text, score: 2, layer: 'sceneMood' })
  }

  // Layer 3: Mood-only fallback (score 1)
  const moodKey = brightness ? `${warmCool}_${brightness}` : `${warmCool}_bright`
  const moodPool = MOOD_CAPTIONS[moodKey]
  if (moodPool) {
    for (const text of moodPool) candidates.push({ text, score: 1, layer: 'mood' })
  }

  // Layer 4: Quality-aware (score 0.5)
  const qualityTier = scores.overall_rating >= 7 ? 'high' : scores.overall_rating >= 5 ? 'medium' : 'low'
  const qualityPool = QUALITY_CAPTIONS[qualityTier]
  if (qualityPool) {
    for (const text of qualityPool) candidates.push({ text, score: 0.5, layer: 'quality' })
  }

  // Shuffle within each layer for randomization
  const shuffled = shuffle(candidates)

  // Greedy diverse selection: pick 5 captions preferring variety across layers
  const picked = []
  const usedLayers = {}
  const usedTexts = new Set()

  // Sort by score descending (shuffled within same score)
  shuffled.sort((a, b) => b.score - a.score)

  for (const c of shuffled) {
    if (picked.length >= 5) break
    if (usedTexts.has(c.text)) continue

    // Apply diversity penalty: if this layer already contributed, lower effective score
    const layerCount = usedLayers[c.layer] || 0
    const effectiveScore = c.score - layerCount * 1.5

    // Only skip if there are still other options and this layer is overrepresented
    if (layerCount >= 2 && picked.length < 4) continue

    picked.push(c)
    usedLayers[c.layer] = layerCount + 1
    usedTexts.add(c.text)
  }

  // Ensure we always have at least 1 quality caption if we have room
  if (picked.length < 5 && !usedLayers.quality) {
    const qCap = shuffle(qualityPool || [])[0]
    if (qCap && !usedTexts.has(qCap)) {
      picked.push({ text: qCap, score: 0.5, layer: 'quality' })
    }
  }

  // Fill remaining slots if needed
  for (const c of shuffled) {
    if (picked.length >= 5) break
    if (!usedTexts.has(c.text)) {
      picked.push(c)
      usedTexts.add(c.text)
    }
  }

  return picked.slice(0, 5).map(c => c.text)
}

// ============================================================
// GEMINI SMART CAPTIONS (optional upgrade — one-time API key)
// ============================================================

const GEMINI_KEY_STORAGE = 'photocritic_gemini_key'

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || ''
}

export function saveGeminiKey(key) {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim())
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function generateSmartCaptions(file, apiKey) {
  if (!apiKey) return []

  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/jpeg'

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `Look at this photo carefully. Generate exactly 5 creative, idiomatic caption suggestions for social media. Each caption should:
- Directly reference specific things visible in the photo (objects, scene, colors, mood, setting)
- Use idioms, metaphors, or poetic expressions that relate to what's actually in the image
- Be short (under 15 words each)
- Feel natural and creative, not generic

Return ONLY a JSON array of 5 strings. No markdown, no explanation. Example format:
["caption 1", "caption 2", "caption 3", "caption 4", "caption 5"]` },
          ],
        }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Gemini API request failed')
  }

  const data = await resp.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const captions = JSON.parse(cleaned)
    if (Array.isArray(captions)) return captions.slice(0, 5)
  } catch {
    const lines = cleaned.split('\n').filter(l => l.trim().length > 3).slice(0, 5)
    return lines.map(l => l.replace(/^["'\d.\-–•]+\s*/, '').replace(/["']$/, '').trim())
  }

  return []
}

// ============================================================
// PUBLIC API
// ============================================================

export async function critiquePhoto(file) {
  const [models, img] = await Promise.all([loadModels(), loadImageEl(file)])

  // Run all analyses in parallel
  const pixelData = getPixelData(img)
  const analysis = analyzePixels(pixelData)
  const scores = computeScores(analysis)

  const [classifications, detections] = await Promise.all([
    mobilenetModel.classify(img, 5),
    cocoModel.detect(img, 10, 0.3),
  ])

  URL.revokeObjectURL(img.src)

  // Normalize COCO-SSD bounding boxes to 0-1 range
  const normalizedDetections = detections.map(d => ({
    ...d,
    bbox: [d.bbox[0] / img.width, d.bbox[1] / img.height, d.bbox[2] / img.width, d.bbox[3] / img.height],
  }))

  const sceneInfo = categorizeScene(classifications)
  const objectInfo = describeObjects(normalizedDetections)
  const feedback = generateFeedback(scores, analysis, sceneInfo, objectInfo)
  const summary = generateSummary(scores, analysis, sceneInfo, objectInfo)
  const captions = generateCaptions(scores, analysis, sceneInfo, objectInfo)

  return { ...scores, feedback, summary, captions }
}

export async function comparePhotos(fileA, fileB) {
  const [models, imgA, imgB] = await Promise.all([loadModels(), loadImageEl(fileA), loadImageEl(fileB)])

  const pxA = analyzePixels(getPixelData(imgA))
  const pxB = analyzePixels(getPixelData(imgB))

  const [classA, classB, detA, detB] = await Promise.all([
    mobilenetModel.classify(imgA, 5), mobilenetModel.classify(imgB, 5),
    cocoModel.detect(imgA, 10, 0.3), cocoModel.detect(imgB, 10, 0.3),
  ])

  const normDetA = detA.map(d => ({ ...d, bbox: [d.bbox[0] / imgA.width, d.bbox[1] / imgA.height, d.bbox[2] / imgA.width, d.bbox[3] / imgA.height] }))
  const normDetB = detB.map(d => ({ ...d, bbox: [d.bbox[0] / imgB.width, d.bbox[1] / imgB.height, d.bbox[2] / imgB.width, d.bbox[3] / imgB.height] }))

  URL.revokeObjectURL(imgA.src)
  URL.revokeObjectURL(imgB.src)

  // Compute raw (unrounded) scores and apply AI model bonuses
  const rawA = applyModelBonus(computeRawScores(pxA), classA, detA)
  const rawB = applyModelBonus(computeRawScores(pxB), classB, detB)

  // Round for display
  const scoresA = roundScores(rawA)
  const scoresB = roundScores(rawB)

  const sceneA = categorizeScene(classA), sceneB = categorizeScene(classB)
  const objA = describeObjects(normDetA), objB = describeObjects(normDetB)

  const fbA = generateFeedback(scoresA, pxA, sceneA, objA)
  const fbB = generateFeedback(scoresB, pxB, sceneB, objB)
  const sumA = generateSummary(scoresA, pxA, sceneA, objA)
  const sumB = generateSummary(scoresB, pxB, sceneB, objB)

  // Use raw (precise) scores to determine winner — avoids rounding ties
  const diff = rawA.overall_rating - rawB.overall_rating
  const TIE_THRESHOLD = 0.15 // scores within 0.15 of each other = tie
  let winner, reason

  if (Math.abs(diff) < TIE_THRESHOLD) {
    winner = 'tie'
    // Even in a tie, highlight what each photo does better
    const aWins = [], bWins = []
    if (rawA.composition > rawB.composition + 0.1) aWins.push('composition')
    if (rawB.composition > rawA.composition + 0.1) bWins.push('composition')
    if (rawA.lighting > rawB.lighting + 0.1) aWins.push('lighting')
    if (rawB.lighting > rawA.lighting + 0.1) bWins.push('lighting')
    if (rawA.color_balance > rawB.color_balance + 0.1) aWins.push('color balance')
    if (rawB.color_balance > rawA.color_balance + 0.1) bWins.push('color balance')
    if (rawA.technical_quality > rawB.technical_quality + 0.1) aWins.push('technical quality')
    if (rawB.technical_quality > rawA.technical_quality + 0.1) bWins.push('technical quality')
    if (rawA.artistic_quality > rawB.artistic_quality + 0.1) aWins.push('artistic vision')
    if (rawB.artistic_quality > rawA.artistic_quality + 0.1) bWins.push('artistic vision')

    if (aWins.length && bWins.length) {
      reason = `It's a close call! Image A edges ahead in ${aWins.join(' and ')}, while Image B shines in ${bWins.join(' and ')}. Both score ${scoresA.overall_rating}/10.`
    } else {
      reason = `Both photos are evenly matched at ${scoresA.overall_rating}/10 — each has its own strengths.`
    }
  } else {
    winner = diff > 0 ? 'A' : 'B'
    const w = winner === 'A' ? rawA : rawB
    const l = winner === 'A' ? rawB : rawA
    const wDisp = winner === 'A' ? scoresA : scoresB
    const lDisp = winner === 'A' ? scoresB : scoresA
    const reasons = []
    if (w.composition > l.composition + 0.1) reasons.push('better composition')
    if (w.lighting > l.lighting + 0.1) reasons.push('superior lighting')
    if (w.color_balance > l.color_balance + 0.1) reasons.push('more balanced colors')
    if (w.technical_quality > l.technical_quality + 0.1) reasons.push('higher technical quality')
    if (w.artistic_quality > l.artistic_quality + 0.1) reasons.push('stronger artistic vision')
    if (!reasons.length) reasons.push('overall stronger execution')

    reason = `Image ${winner} wins with ${reasons.join(' and ')}, scoring ${wDisp.overall_rating}/10 vs ${lDisp.overall_rating}/10.`
  }

  const capsA = generateCaptions(scoresA, pxA, sceneA, objA)
  const capsB = generateCaptions(scoresB, pxB, sceneB, objB)

  return {
    image_a: { ...scoresA, feedback: fbA, summary: sumA, captions: capsA },
    image_b: { ...scoresB, feedback: fbB, summary: sumB, captions: capsB },
    winner, reason,
  }
}
