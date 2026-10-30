"use strict";

/**
 * Lecteur PNG minimal (8 bits, RGB/RGBA, non entrelacé) pour les tests.
 *
 * Sert à vérifier réellement le rendu de contrôle Blender : taille de l'image et
 * contenu de chacun des quatre quarts. Aucune dépendance externe n'est ajoutée.
 * Les images produites par Blender (EEVEE/Workbench) et par son assembleur sont
 * dans ce format ; un PNG inattendu lève une erreur explicite plutôt que de
 * valider à tort.
 */

const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

/** Décode un PNG en { width, height, channels, data } (data = pixels RGB(A) défiltrés). */
function decode(buffer) {
    if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("Ce n'est pas un PNG.");
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idat = [];

    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const body = buffer.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;

        if (type === "IHDR") {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            bitDepth = body[8];
            colorType = body[9];
            interlace = body[12];
        } else if (type === "IDAT") {
            idat.push(body);
        } else if (type === "IEND") {
            break;
        }
    }

    if (bitDepth !== 8) throw new Error(`Profondeur ${bitDepth} bits non gérée (8 attendu).`);
    if (interlace !== 0) throw new Error("PNG entrelacé non géré.");
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : null;
    if (!channels) throw new Error(`Type de couleur ${colorType} non géré.`);

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const data = Buffer.alloc(stride * height);

    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = data.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
            const left = x >= channels ? out[x - channels] : 0;
            const up = y > 0 ? data[(y - 1) * stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? data[(y - 1) * stride + x - channels] : 0;
            let value = line[x];
            if (filter === 1) value += left;
            else if (filter === 2) value += up;
            else if (filter === 3) value += Math.floor((left + up) / 2);
            else if (filter === 4) value += paeth(left, up, upLeft);
            else if (filter !== 0) throw new Error(`Filtre PNG ${filter} inconnu.`);
            out[x] = value & 0xff;
        }
    }

    return { width, height, channels, data };
}

/** Écart-type de luminance d'une région : une zone vide ou uniforme reste proche de 0. */
function regionContrast(png, x0, y0, x1, y1) {
    const { channels, data, width } = png;
    let count = 0;
    let sum = 0;
    let sumSquares = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * channels;
            const luminance = channels >= 3 ? (data[i] + data[i + 1] + data[i + 2]) / 3 : data[i];
            count++;
            sum += luminance;
            sumSquares += luminance * luminance;
        }
    }
    if (!count) return 0;
    const mean = sum / count;
    return Math.sqrt(Math.max(0, sumSquares / count - mean * mean));
}

module.exports = { decode, regionContrast };
