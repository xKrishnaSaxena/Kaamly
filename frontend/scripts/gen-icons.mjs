// Generates Kaamly PWA icons as PNGs with zero dependencies (pure Node zlib).
// Draws the brand mark: an indigo rounded-square with a white microphone.
// Run: node scripts/gen-icons.mjs   (also runs automatically before dev/build)
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/* ---------- PNG encoder ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const u32 = (n) => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0)
  return b
}
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii')
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))])
}
const encodePNG = (w, h, rgba) => {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.concat([u32(w), u32(h), Buffer.from([8, 6, 0, 0, 0])])
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ---------- tiny SDF rasterizer ---------- */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const sdRoundRect = (px, py, cx, cy, w, h, r) => {
  const qx = Math.abs(px - cx) - (w / 2 - r)
  const qy = Math.abs(py - cy) - (h / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4) // transparent
  const S = size
  const k = maskable ? 0.82 : 1 // shrink content into safe zone for maskable
  const cx = S / 2

  // mic geometry (pixel space)
  const capW = 0.3 * S * k
  const capH = 0.44 * S * k
  const capCy = S * 0.4
  const ringCy = S * 0.42
  const ringR = 0.22 * S * k
  const ringT = 0.055 * S * k
  const stemW = 0.05 * S * k
  const baseW = 0.24 * S * k

  const blend = (i, r, g, b, a) => {
    if (a <= 0) return
    const ia = 1 - a
    buf[i] = Math.round(r * a + buf[i] * ia)
    buf[i + 1] = Math.round(g * a + buf[i + 1] * ia)
    buf[i + 2] = Math.round(b * a + buf[i + 2] * ia)
    buf[i + 3] = Math.round(255 * a + buf[i + 3] * ia)
  }

  for (let y = 0; y < S; y++) {
    // vertical brand gradient: #7C6CF5 -> #4F46E5
    const t = y / S
    const bg = [
      Math.round(0x7c + (0x4f - 0x7c) * t),
      Math.round(0x6c + (0x46 - 0x6c) * t),
      Math.round(0xf5 + (0xe5 - 0xf5) * t)
    ]
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      // background: full-bleed rounded square (square for maskable)
      const bgCov = clamp01(0.5 - sdRoundRect(x, y, cx, S / 2, S, S, maskable ? 0 : S * 0.22))
      blend(i, bg[0], bg[1], bg[2], bgCov)

      // white microphone = union of capsule + lower-half ring + stem + base
      let w = clamp01(0.5 - sdRoundRect(x, y, cx, capCy, capW, capH, capW / 2))
      if (y >= ringCy) {
        const ring = Math.abs(sdCircle(x, y, cx, ringCy, ringR)) - ringT / 2
        w = Math.max(w, clamp01(0.5 - ring))
      }
      w = Math.max(w, clamp01(0.5 - sdRoundRect(x, y, cx, S * 0.66, stemW, S * 0.14 * k, stemW / 2)))
      w = Math.max(w, clamp01(0.5 - sdRoundRect(x, y, cx, S * 0.8, baseW, 0.05 * S * k, 0.025 * S * k)))
      blend(i, 255, 255, 255, w)
    }
  }
  return encodePNG(S, S, buf)
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
const targets = [
  ['pwa-192x192.png', 192, false],
  ['pwa-512x512.png', 512, false],
  ['maskable-512x512.png', 512, true],
  ['apple-touch-icon.png', 180, false]
]
for (const [name, size, maskable] of targets) {
  writeFileSync(join(OUT, name), render(size, { maskable }))
  console.log('  ✓', name)
}
console.log('Kaamly icons generated in public/')
