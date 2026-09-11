import sharp from 'sharp';
import { writeFileSync } from 'fs';

const EMOJI_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f4ee.png';

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function makeIcon(size) {
  const emoji = await fetchBuffer(EMOJI_URL);
  const emojiSize = Math.round(size * 0.72);

  const background = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#764ba2"/>
          <stop offset="100%" stop-color="#667eea"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.21)}" fill="url(#bg)"/>
    </svg>
  `);

  const emojiPng = await sharp(emoji)
    .resize(emojiSize, emojiSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const left = Math.round((size - emojiSize) / 2);
  const top = Math.round((size - emojiSize) / 2);

  return sharp(background)
    .composite([{ input: emojiPng, left, top }])
    .png()
    .toBuffer();
}

const icon192 = await makeIcon(192);
const icon512 = await makeIcon(512);
writeFileSync('icon-192.png', icon192);
writeFileSync('icon-512.png', icon512);
console.log('generated icon-192.png and icon-512.png');
