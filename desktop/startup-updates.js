"use strict";

function configuredRepository() {
    return { owner: "leo51500", repo: "francestudents-code-Roblox" };
}

function unavailable(message) {
    return { status: "unavailable", availableVersion: null, canInstall: false, downloadUrl: null, message };
}

// Portable builds can check public releases but never install themselves.
async function checkPortableRelease(version, fetchImpl = fetch) {
    const repository = configuredRepository();
    const { owner, repo } = repository;
    const validPart = value => typeof value === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(value) && value !== "." && value !== "..";
    if (!validPart(owner) || !validPart(repo)) return unavailable("La configuration de la source de mise à jour est invalide.");
    const ownerPath = encodeURIComponent(owner), repoPath = encodeURIComponent(repo);
    const baseUrl = `https://github.com/${ownerPath}/${repoPath}`;
    const response = await fetchImpl(`https://api.github.com/repos/${ownerPath}/${repoPath}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Source de mises à jour indisponible.");
    const release = await response.json();
    const parse = value => /^(?:v)?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
    const next = parse(release.tag_name), current = parse(version);
    if (!next || !current || release.draft || release.prerelease) throw new Error("Version publiée invalide.");
    let newer = false;
    for (let i = 1; i <= 3; i++) {
        if (Number(next[i]) !== Number(current[i])) { newer = Number(next[i]) > Number(current[i]); break; }
    }
    return {
        status: newer ? "available" : "current", availableVersion: newer ? next.slice(1).join(".") : null,
        canInstall: false,
        downloadUrl: newer ? `${baseUrl}/releases/latest` : null,
        message: newer ? `La version ${next.slice(1).join(".")} est disponible. Version portable : télécharge l’installateur depuis les releases GitHub pour la mettre à jour.` : "Aucune mise à jour plus récente disponible."
    };
}

module.exports = { checkPortableRelease, configuredRepository };
