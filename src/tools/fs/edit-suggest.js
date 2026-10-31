"use strict";

/**
 * Suggestion de correspondance pour edit_file.
 *
 * Quand old_string est introuvable, le modèle reçoit aujourd'hui un message
 * générique : il relit le fichier, réessaie avec une variante, ou abandonne.
 * Ici, on retrouve la zone du fichier qui ressemble le plus à ce qu'il a
 * envoyé (espaces, indentation, virgules, guillemets et espaces insécables
 * tolérés) et on lui propose le texte EXACT à recopier, avec ses lignes.
 *
 * Ce n'est pas une édition approximative : rien n'est modifié. La fonction
 * renvoie seulement une suggestion lisible, et le modèle doit la renvoyer
 * telle quelle dans un nouvel appel.
 */

/** Forme comparable : espaces normalisés, guillemets et tirets typographiques unifiés. */
function normalizeLine(line) {
    return String(line ?? "")
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u00A0\u202F\u2009]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/ ?([,:;]) ?/g, "$1")
        .replace(/\b(fn|const|let|var|return|local|then|do)\s+/g, "$1 ")
        .trim();
}

/** Similarité 0..1 entre deux lignes (préfixe + tronc commun), bon marché. */
function lineScore(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const max = Math.max(a.length, b.length);
    let common = 0;
    const limit = Math.min(a.length, b.length);
    while (common < limit && a[common] === b[common]) common++;
    return common / max;
}

/**
 * Fenêtre du fichier la plus proche de `needle`.
 * Renvoie { startLine, endLine, text, score } ou null sous le seuil.
 */
function closestMatch(content, needle, { minScore = 0.55 } = {}) {
    const source = String(content ?? "");
    const wanted = String(needle ?? "").split(/\r?\n/);
    const wantedLines = wanted.map(normalizeLine);
    // Ignore les lignes vides en tête et en queue : elles trompent l'ancrage.
    while (wantedLines.length && !wantedLines[0]) wantedLines.shift();
    while (wantedLines.length && !wantedLines[wantedLines.length - 1]) wantedLines.pop();
    if (!wantedLines.length || !source) return null;

    const lines = source.split(/\r?\n/);
    const normalized = lines.map(normalizeLine);
    const size = wantedLines.length;
    let best = null;

    // Retire les lignes vides significatives de la comparaison : le modèle ajoute
    // souvent une ligne vide que le fichier n'a pas.
    const anchor = wantedLines[0];

    for (let i = 0; i + size <= normalized.length + 1; i++) {
        let score = 0;
        let matched = 0;
        for (let j = 0; j < size; j++) {
            const line = normalized[i + j] ?? "";
            const value = lineScore(wantedLines[j], line);
            if (value >= 0.75) matched++;
            score += value;
        }
        score = size === 1
            ? lineScore(anchor, normalized[i])
            : (score / size) * 0.75 + (matched / size) * 0.25;
        // Bonus fort si la première ligne correspond presque exactement.
        if (normalized[i] && lineScore(anchor, normalized[i]) >= 0.9) score = Math.min(1, score + 0.12);
        if (!best || score > best.score) {
            best = { startLine: i + 1, endLine: Math.min(lines.length, i + size), score };
        }
    }

    if (!best || best.score < minScore) return null;

    const text = lines.slice(best.startLine - 1, best.endLine).join("\n");
    if (!text.trim()) return null;
    return { ...best, text };
}

/** Première ligne du fichier qui diffère, quand la suggestion reste ambigüe. */
function firstDifference(content, needle) {
    const wanted = String(needle ?? "").split(/\r?\n/).map(normalizeLine);
    const lines = String(content ?? "").split(/\r?\n/).map(normalizeLine);
    for (let i = 0; i < Math.max(wanted.length, lines.length); i++) {
        if (wanted[i] !== lines[i]) return i + 1;
    }
    return null;
}

/** Message d'erreur enrichi : l'agent peut corriger en un seul nouvel essai. */
function notFoundMessage(rel, content, needle) {
    const suggestion = closestMatch(content, needle);
    const base = `old_string est introuvable dans ${rel}.`;
    if (!suggestion) {
        return `${base} Relis la zone avec read_file (start_line/end_line) et copie le texte exactement, ou remplace une portion plus courte.`;
    }
    const location = suggestion.startLine === suggestion.endLine
        ? `ligne ${suggestion.startLine}`
        : `lignes ${suggestion.startLine} à ${suggestion.endLine}`;
    const confidence = suggestion.score >= 0.85 ? "très proche" : "plus proche";
    return `${base} Correspondance ${confidence} : ${location} (${Math.round(suggestion.score * 100)} %). Texte réel du fichier à utiliser comme old_string (copie-le exactement, indentation comprise) :\n` +
        `${suggestion.text}\n` +
        `— Ne renvoie pas une version reformatée de ta partie. Si ce passage ne convient pas, relis ${location} avec read_file et cible un extrait plus court d'une seule ligne.`;
}

module.exports = { normalizeLine, lineScore, closestMatch, firstDifference, notFoundMessage };
