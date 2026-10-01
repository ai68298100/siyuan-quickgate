/**
 * 生成小驴快门 logo（小驴系列视觉：浅底圆角 + 渐变主形 + 白色图形 + 橙点）。
 * 与打卡(紫对勾+橙点)、雷切(蓝闪电)、人脉(青绿双人)区分：
 * 快门 = 蓝紫渐变卡片 + 白色门框（gateway）+ 穿门速度线 + 橙色联动点。
 * SDF 距离场绘制 + 3x3 超采样，纯 Node 零依赖（PNG 编码器与人脉 gen-icon 同源）。
 *
 * 用法：node scripts/gen-icon.mjs [a|b|c]
 * 变体：a 蓝紫卡片·门框+速度线 / b 深底白描边门 / c 极简门+点
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/* ---------- PNG 编码（与人脉 gen-icon 同源） ---------- */

function crc32(buffer) {
    let table = crc32.table;
    if (!table) {
        table = crc32.table = new Int32Array(256);
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c;
        }
    }
    let crc = -1;
    for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, pixelAt) {
    const raw = Buffer.alloc(height * (1 + width * 3));
    for (let y = 0; y < height; y += 1) {
        const rowStart = y * (1 + width * 3);
        raw[rowStart] = 0;
        for (let x = 0; x < width; x += 1) {
            const [r, g, b] = pixelAt(x, y);
            const offset = rowStart + 1 + x * 3;
            raw[offset] = r;
            raw[offset + 1] = g;
            raw[offset + 2] = b;
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

/* ---------- SDF（与人脉 gen-icon 同源） ---------- */

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

function sdRoundRect(px, py, cx, cy, hx, hy, r) {
    const qx = Math.abs(px - cx) - (hx - r);
    const qy = Math.abs(py - cy) - (hy - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCapsule(px, py, ax, ay, bx, by, r) {
    const pax = px - ax;
    const pay = py - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = Math.min(Math.max((pax * bax + pay * bay) / (bax * bax + bay * bay), 0), 1);
    return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

function shape(sdf, fill, alpha = 1) {
    return { sdf, fill, alpha };
}

function mix(base, over, alpha) {
    return [
        base[0] + (over[0] - base[0]) * alpha,
        base[1] + (over[1] - base[1]) * alpha,
        base[2] + (over[2] - base[2]) * alpha,
    ];
}

function diagGradient(topLeft, bottomRight) {
    return (x, y) => {
        const t = Math.min(Math.max((x + y) / 200, 0), 1);
        return [
            topLeft[0] + (bottomRight[0] - topLeft[0]) * t,
            topLeft[1] + (bottomRight[1] - topLeft[1]) * t,
            topLeft[2] + (bottomRight[2] - topLeft[2]) * t,
        ];
    };
}

function vGradient(y0, y1, top, bottom) {
    return (_x, y) => {
        const t = Math.min(Math.max((y - y0) / (y1 - y0), 0), 1);
        return [
            top[0] + (bottom[0] - top[0]) * t,
            top[1] + (bottom[1] - top[1]) * t,
            top[2] + (bottom[2] - top[2]) * t,
        ];
    };
}

function render(width, height, shapes) {
    const scale = Math.min(width, height) / 160;
    const offsetX = (width - 160 * scale) / 2;
    const offsetY = (height - 160 * scale) / 2;
    const ss = 3;
    const offsets = [];
    for (let sy = 0; sy < ss; sy += 1) for (let sx = 0; sx < ss; sx += 1) offsets.push([(sx + 0.5) / ss, (sy + 0.5) / ss]);
    return (x, y) => {
        let acc = [255, 255, 255];
        for (const [sx, sy] of offsets) {
            const ux = (x + sx - offsetX) / scale;
            const uy = (y + sy - offsetY) / scale;
            let color = [255, 255, 255];
            for (const item of shapes) {
                const d = item.sdf(ux, uy);
                const cover = Math.min(Math.max(0.5 - d, 0), 1);
                if (cover <= 0) continue;
                const fill = typeof item.fill === "function" ? item.fill(ux, uy) : item.fill;
                color = mix(color, fill, cover * item.alpha);
            }
            acc = [acc[0] + color[0] / (ss * ss), acc[1] + color[1] / (ss * ss), acc[2] + color[2] / (ss * ss)];
        }
        return [Math.round(acc[0]), Math.round(acc[1]), Math.round(acc[2])];
    };
}

const LIGHT_BG = (x, y) => vGradient(2, 158, [246, 248, 253], [232, 238, 250])(x, y);
const basePlate = () => shape((x, y) => sdRoundRect(x, y, 80, 80, 78, 78, 34), LIGHT_BG);

/* ---------- 变体 ---------- */

const PURPLE = { a: [129, 98, 255], b: [56, 140, 255] }; // 蓝紫渐变（区别于打卡紫勾/雷切蓝电）
const WHITE = [255, 255, 255];
const ORANGE = [255, 149, 40]; // 小驴系橙点

/** a：蓝紫渐变卡片 + 白色门框 + 穿门速度线 + 橙色联动点（推荐） */
function variantA() {
    return [
        basePlate(),
        shape((x, y) => sdRoundRect(x, y, 80, 82, 48, 45, 16), diagGradient(PURPLE.a, PURPLE.b)),
        // 门框：左右柱 + 横梁（白色 gateway）
        shape((x, y) => sdCapsule(x, y, 60, 62, 60, 104, 6), WHITE),
        shape((x, y) => sdCapsule(x, y, 100, 62, 100, 104, 6), WHITE),
        shape((x, y) => sdCapsule(x, y, 52, 58, 108, 58, 6), WHITE),
        // 速度线：从门外穿门而过
        shape((x, y) => sdCapsule(x, y, 40, 92, 92, 76, 4.6), WHITE),
        // 橙色联动点（速度线末端外侧）
        shape((x, y) => sdCircle(x, y, 108, 72, 7), ORANGE),
    ];
}

/** b：深蓝紫底 + 白描边门框（货架辨识度优先） */
function variantB() {
    const sdRing = (px, py, ax, ay, bx, by, r, w) => {
        const d = sdCapsule(px, py, ax, ay, bx, by, r);
        return Math.abs(d) - w;
    };
    return [
        shape((x, y) => sdRoundRect(x, y, 80, 80, 78, 78, 34), diagGradient([64, 44, 168], [34, 96, 200])),
        shape((x, y) => sdRing(x, y, 60, 62, 60, 104, 5.4, 3), WHITE),
        shape((x, y) => sdRing(x, y, 100, 62, 100, 104, 5.4, 3), WHITE),
        shape((x, y) => sdCapsule(x, y, 52, 58, 108, 58, 5.4), WHITE),
        shape((x, y) => sdCapsule(x, y, 42, 92, 90, 76, 4), WHITE),
        shape((x, y) => sdCircle(x, y, 106, 72, 6.5), ORANGE),
    ];
}

/** c：极简——浅底 + 门框剪影 + 橙点（最小尺寸可读） */
function variantC() {
    const fill = diagGradient(PURPLE.a, PURPLE.b);
    return [
        basePlate(),
        shape((x, y) => sdCapsule(x, y, 62, 58, 62, 104, 7), fill),
        shape((x, y) => sdCapsule(x, y, 98, 58, 98, 104, 7), fill),
        shape((x, y) => sdCapsule(x, y, 54, 54, 106, 54, 7), fill),
        shape((x, y) => sdCapsule(x, y, 44, 90, 90, 76, 4.4), fill),
        shape((x, y) => sdCircle(x, y, 106, 72, 7), ORANGE),
    ];
}

const VARIANTS = { a: variantA, b: variantB, c: variantC };

const root = path.resolve(import.meta.dirname, "..");
const picked = process.argv.slice(2).find((arg) => VARIANTS[arg]) ?? "a";

fs.writeFileSync(path.join(root, "icon.png"), encodePng(160, 160, render(160, 160, VARIANTS[picked]())));
fs.writeFileSync(path.join(root, "preview.png"), encodePng(1024, 768, render(1024, 768, VARIANTS[picked]())));
console.log(`icon.png / preview.png 已生成（变体 ${picked}）`);
