"use strict";
// Construit le corps de la fiche de release à partir du résumé de
// desktop/release-highlights.js. Utilisé par .github/workflows/auto-release.yml.
// Un résumé absent ou illisible ne doit jamais empêcher la publication.

function buildReleaseBody(version, releases) {
    const entry = releases && releases[version];
    const items = (entry && Array.isArray(entry.items)) ? entry.items : [];
    const lines = [];
    if (entry && entry.headline) lines.push(`**${entry.headline}**`, "");
    for (const item of items) lines.push(`- **${item.title}** : ${item.text}`);
    lines.push("", "## Téléchargement", "");
    lines.push(`Installateur Windows 64 bits : \`FranceStudentCodeRoblox-${version}-setup.exe\`.`);
    lines.push("", "Ferme l’ancienne version avant de lancer l’installation. Les fichiers apparaissent au fur et à mesure de la construction.");
    return lines.join("\n") + "\n";
}

function fallbackBody(version) {
    return `FranceStudent Code Roblox ${version}. Installateur Windows 64 bits : FranceStudentCodeRoblox-${version}-setup.exe.\n`;
}

if (require.main === module) {
    const version = String(process.argv[2] || "").trim();
    if (!version) {
        process.stderr.write("Usage : node scripts/release-body.js <version>\n");
        process.exit(1);
    }
    let body = "";
    try {
        body = buildReleaseBody(version, require("../desktop/release-highlights.js").releases);
    } catch (error) {
        process.stderr.write(`Résumé indisponible : ${error.message}\n`);
    }
    process.stdout.write(body.trim() ? body : fallbackBody(version));
}

module.exports = { buildReleaseBody, fallbackBody };
