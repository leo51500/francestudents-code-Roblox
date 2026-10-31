/* ---------- Rendu du texte ---------- */

const TOOL_LABELS = {
    ask_user: "Question de l’agent",
    effectcraft: "EffectCraft",
    list_directory: "Lister", read_file: "Lire", search_files: "Chercher", find_files: "Trouver des fichiers",
    read_attachment: "Lire la pièce jointe", web_search_result: "Résultat web", view_image: "Examiner l’image",
    create_directory: "Créer le dossier", write_file: "Écrire", edit_file: "Éditer",
    move_path: "Déplacer", copy_path: "Copier", delete_path: "Supprimer",
    remember: "Mémoriser", run_command: "Commande", web_search: "Rechercher sur le web", web_fetch: "Lire une source",
    update_plan: "Actualiser le plan", semantic_search: "Explorer le code", diagnostics: "Diagnostics",
    browse: "Vérifier la page", job_output: "Lire la commande", job_stop: "Arrêter la commande",
    task: "Sous-agent", use_skill: "Charger une compétence", mcp_call: "Appel MCP", github: "GitHub",
    roblox_check: "Vérifier le jeu Roblox", roblox_game: "Créer le jeu Roblox", roblox_scene: "Construire la scène Roblox",
    roblox_env: "Vérifier l’environnement Roblox", roblox_playtest: "Tester dans Roblox Studio",
    roblox_graph: "Analyser la structure Roblox", rojo_serve: "Lancer le serveur Rojo", blender: "Blender"
};

function toolLabel(name) {
    return TOOL_LABELS[name] || String(name ?? "");
}

function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function inline(text) {
    return String(text ?? "").split(/(`[^`]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s<>]+)/g).map(part => {
        if (part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
        if (part.startsWith("**") && part.endsWith("**")) return `<b>${escapeHtml(part.slice(2, -2))}</b>`;
        const match = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
        const url = match ? match[2] : /^https?:\/\//.test(part) ? part : null;
        if (url) return `<a href="${escapeHtml(url)}" data-web-url="${escapeHtml(url)}">${escapeHtml(match ? match[1] : url)}</a>`;
        return escapeHtml(part);
    }).join("");
}

function renderMarkdown(src) {
    if(typeof window!=="undefined"&&window.StudioVendor) {
        const template=document.createElement("template");template.innerHTML=window.StudioVendor.markdown(src);
        for(const anchor of template.content.querySelectorAll("a")) {
            const href=anchor.getAttribute("href")||"";
            if(/^https?:\/\//i.test(href))anchor.dataset.webUrl=href;
            else anchor.removeAttribute("href");
        }
        return template.innerHTML;
    }
    const lines = String(src ?? "").split("\n");
    let html = "";
    let block = null;
    let list = null;
    const closeList = () => {
        if (list) {
            html += `</${list}>`;
            list = null;
        }
    };

    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) {
            if (block === null) {
                closeList();
                block = [];
            } else {
                html += `<pre><code>${escapeHtml(block.join("\n"))}</code></pre>`;
                block = null;
            }
            continue;
        }
        if (block !== null) {
            block.push(line);
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        if (heading) {
            closeList();
            html += `<h4>${inline(heading[2])}</h4>`;
        } else if (bullet || numbered) {
            const kind = bullet ? "ul" : "ol";
            if (list !== kind) {
                closeList();
                html += `<${kind}>`;
                list = kind;
            }
            html += `<li>${inline((bullet || numbered)[1])}</li>`;
        } else if (!line.trim()) {
            closeList();
            html += "<br>";
        } else {
            closeList();
            html += `<div>${inline(line)}</div>`;
        }
    }

    if (block !== null) html += `<pre><code>${escapeHtml(block.join("\n"))}</code></pre>`;
    closeList();
    return html;
}

function diffLine(line) {
    if (typeof line === "string") {
        const first = line[0];
        const cls = first === "+" ? "add" : first === "-" ? "del" : first === "@" ? "hunk" : "";
        return { text: line, cls };
    }
    const kind = String(line?.type ?? line?.kind ?? line?.op ?? "");
    const text = String(line?.text ?? line?.line ?? line?.value ?? "");
    const cls = /add|ins|\+/.test(kind) ? "add" : /del|rem|-/.test(kind) ? "del" : /hunk|sep|@/.test(kind) ? "hunk" : "";
    const sign = cls === "add" ? "+ " : cls === "del" ? "- " : "  ";
    return { text: cls === "hunk" ? text : sign + text, cls };
}

function buildDiffCard(entry) {
    const lines = entry.lines || [];
    const card = document.createElement("div");
    card.className = "diff-card";
    // Un changement volumineux masque le reste de la conversation : on garde un résumé
    // lisible (fichier, +/-, nombre de lignes) et le détail s'ouvre au clic.
    const detail = document.createElement("details");
    detail.className = "diff-details";
    detail.open = lines.length <= 12;

    const head = document.createElement("summary");
    head.className = "diff-head";
    head.title = "Afficher ou masquer les lignes modifiées";
    if (entry.path) {
        head.appendChild(fileIcon(entry.path, "file"));
        const p = document.createElement("span");
        p.className = "diff-path";
        p.textContent = entry.path;
        p.title = `${entry.path} — cliquez pour ouvrir`;
        p.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            openFile(entry.path);
        };
        head.appendChild(p);
    } else {
        const summary = document.createElement("span");
        summary.className = "diff-summary";
        summary.textContent = "Modification";
        head.appendChild(summary);
    }

    const stats = document.createElement("span");
    stats.className = "diff-stats";
    const add = document.createElement("b");
    add.className = "add";
    add.textContent = `+${entry.added ?? 0}`;
    const del = document.createElement("b");
    del.className = "del";
    del.textContent = `-${entry.removed ?? 0}`;
    stats.append(add, del);
    head.appendChild(stats);

    const chevron = document.createElement("span");
    chevron.className = "diff-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = '<svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>';
    head.appendChild(chevron);

    const body = document.createElement("div");
    body.className = "diff";
    body.innerHTML = lines
        .map((line) => {
            const d = diffLine(line);
            return `<div class="${d.cls}">${escapeHtml(d.text) || " "}</div>`;
        })
        .join("");

    detail.append(head, body);
    card.appendChild(detail);
    return card;
}

