/* ---------- Coloration syntaxique de l'éditeur ---------- */

const JS_KEYWORDS = ("await async break case catch class const continue debugger default delete do else enum export extends " +
    "false finally for from function get if implements import in instanceof interface let new null of return set static " +
    "super switch this throw true try typeof undefined var void while with yield").split(" ");
const TS_EXTRA = ("type namespace declare public private protected readonly abstract keyof infer never unknown any satisfies " +
    "as is asserts").split(" ");
const HL_KEYWORDS = {
    js: new Set(JS_KEYWORDS),
    ts: new Set([...JS_KEYWORDS, ...TS_EXTRA]),
    json: new Set(["true", "false", "null"]),
    py: new Set(("and as assert async await break class continue def del elif else except False finally for from global if " +
        "import in is lambda None nonlocal not or pass raise return True try while with yield self").split(" ")),
    lua: new Set(("and break continue do else elseif end export false for function if import in local nil not or repeat return " +
        "then true type typeof until while").split(" "))
};

/* API et types Roblox/Luau courants : repérés comme types pour une lecture rapide. */
const LUAU_BUILTINS = new Set(("game workspace script Instance Vector2 Vector3 Vector2int16 Vector3int16 CFrame Color3 " +
    "ColorSequence ColorSequenceKeypoint NumberSequence NumberSequenceKeypoint NumberRange TweenInfo UDim UDim2 Rect " +
    "Ray RaycastParams Region3 BrickColor Enum Random DateTime task os math string table coroutine bit32 utf8 buffer " +
    "debug select typeof type pairs ipairs next tostring tonumber print warn error assert require setmetatable " +
    "getmetatable rawget rawset rawequal rawlen unpack newproxy tick wait spawn delay elapsedTime Game Players RunService " +
    "ReplicatedStorage ServerStorage ServerScriptService StarterGui StarterPack Lighting SoundService Debris CollectionService " +
    "TweenService MarketplaceService DataStoreService PathfindingService UserInputService ContextActionService HttpService " +
    "TextService GuiService PhysicsService TeleportService MessagingService BadgeService InsertService LocalizationService " +
    "PolicyService MemoryStoreService NumberValue StringValue BoolValue ObjectValue RemoteEvent RemoteFunction BindableEvent " +
    "BindableFunction ModuleScript Humanoid Animator Attachment Motor6D WeldConstraint ProximityPrompt ScreenGui TextLabel " +
    "TextButton Frame Part MeshPart Model Folder Animation Sound Camera").split(" "));

function hlSpan(cls, text) {
    return `<span class="tok-${cls}">${escapeHtml(text)}</span>`;
}

function hlClike(text, kw) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\w.]*\b|\b0[xX][0-9a-fA-F]+\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:=+\-*/%<>!&|?~^]+)/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (m[1] != null) out += hlSpan("comment", m[1]);
        else if (m[2] != null) out += hlSpan("string", m[2]);
        else if (m[3] != null) out += hlSpan("number", m[3]);
        else if (m[4] != null) {
            const word = m[4];
            const prev = text[m.index - 1];
            const rest = text.slice(re.lastIndex);
            if (kw.has(word)) out += hlSpan("keyword", word);
            else if (/^\s*\(/.test(rest)) out += hlSpan("func", word);
            else if (prev === ".") out += hlSpan("prop", word);
            else if (/^[A-Z]/.test(word)) out += hlSpan("type", word);
            else out += escapeHtml(word);
        } else {
            out += hlSpan("punct", m[5]);
        }
        last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
}

function hlPython(text) {
    const kw = HL_KEYWORDS.py;
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\w.]*\b)|([A-Za-z_]\w*)|([{}()[\];,.:=+\-*/%<>!&|?~^@]+)/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (m[1] != null) out += hlSpan("comment", m[1]);
        else if (m[2] != null) out += hlSpan("string", m[2]);
        else if (m[3] != null) out += hlSpan("number", m[3]);
        else if (m[4] != null) {
            const word = m[4];
            const rest = text.slice(re.lastIndex);
            if (kw.has(word)) out += hlSpan("keyword", word);
            else if (/^\s*\(/.test(rest)) out += hlSpan("func", word);
            else if (/^[A-Z]/.test(word)) out += hlSpan("type", word);
            else out += escapeHtml(word);
        } else {
            out += hlSpan("punct", m[5]);
        }
        last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
}

/* Luau : commentaires -- et --[[ ]], chaînes "" '' et longues [[ ]], types après ':', attributs @. */
/* Luau : commentaires -- et --[[ ]], chaînes "" '' et longues [[ ]], types après ':', attributs @. */
/* Luau : commentaires -- et --[[ ]], chaînes "" '' et longues [[ ]], types après ':', attributs @. */
function hlLuau(text) {
    const kw = HL_KEYWORDS.lua;
    /* Un seul motif : chaque branche a son propre groupe pour que les groupes 1 à 6 restent
       commentaire, chaîne, nombre, attribut, identifiant, ponctuation. */
    const re = /(--\[(=*)\[|--)|(\[(=*)\[|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b0[xX][0-9a-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)|([{}()[\];,.:=+\-*/%<>~^#]+)/g;
    let out = "";
    let last = 0;
    /* Long bracket (commentaire ou chaîne) ouvert : tout est du texte jusqu'à la fermeture. */
    let longClose = null;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m[0] === "") re.lastIndex += 1;
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (longClose) {
            if (text.startsWith(longClose, m.index)) {
                out += hlSpan("string", longClose);
                re.lastIndex = m.index + longClose.length;
                longClose = null;
                last = re.lastIndex;
                continue;
            }
            out += hlSpan("string", m[0]);
        } else if (m[1] != null) {
            const open = m[2] != null;
            out += hlSpan("comment", m[1]);
            if (open) {
                longClose = "]" + m[3] + "]";
            } else if (text[re.lastIndex] !== "\n") {
                const newline = text.indexOf("\n", re.lastIndex);
                const lineEnd = newline >= 0 ? newline : text.length;
                out += hlSpan("comment", text.slice(re.lastIndex, lineEnd));
                re.lastIndex = lineEnd;
            }
        } else if (m[4] != null) {
            const open = /^\[(=*)\[/.exec(m[4]);
            out += hlSpan("string", m[4]);
            if (open) longClose = "]" + open[1] + "]";
        } else if (m[5] != null) out += hlSpan("number", m[5]);
        else if (m[6] != null) out += hlSpan("atrule", m[6]);
        else if (m[7] != null) {
            const word = m[7];
            const before = text.slice(Math.max(0, m.index - 1), m.index);
            const rest = text.slice(re.lastIndex);
            if (kw.has(word)) out += hlSpan("keyword", word);
            else if (before === ":") out += hlSpan("type", word);
            else if (LUAU_BUILTINS.has(word)) out += hlSpan("type", word);
            else if (/^\s*(\(|->)/.test(rest)) out += hlSpan("func", word);
            else if (before === ".") out += hlSpan("prop", word);
            else if (/^[A-Z]/.test(word)) out += hlSpan("type", word);
            else out += escapeHtml(word);
        } else {
            out += hlSpan("punct", m[8]);
        }
        last = re.lastIndex;
    }
    if (longClose && last < text.length) {
        out += hlSpan("string", text.slice(last));
        last = text.length;
    }
    return out + escapeHtml(text.slice(last));
}

function hlCss(text) {
    const re = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b)|(@[a-zA-Z-]+)|([.#:%][A-Za-z_][\w-]*|::?[a-zA-Z-]+)|([a-zA-Z-]+)(?=\s*:)|(-?\d*\.?\d+(?:[a-z%]{1,4})?)|([{}();:,>~+])/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (m[1] != null) out += hlSpan("comment", m[1]);
        else if (m[2] != null) out += hlSpan("string", m[2]);
        else if (m[3] != null) out += hlSpan("color", m[3]);
        else if (m[4] != null) out += hlSpan("atrule", m[4]);
        else if (m[5] != null) out += hlSpan("selector", m[5]);
        else if (m[6] != null) out += hlSpan("prop", m[6]);
        else if (m[7] != null) out += hlSpan("number", m[7]);
        else out += hlSpan("punct", m[8]);
        last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
}

function hlHtml(text) {
    const re = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*)|([a-zA-Z_:][\w:.-]*)(?==)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(&[a-zA-Z#0-9]+;)|(\/?>)/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (m[1] != null) out += hlSpan("comment", m[1]);
        else if (m[2] != null) out += hlSpan("tag", m[2]);
        else if (m[3] != null) out += hlSpan("attr", m[3]);
        else if (m[4] != null) out += hlSpan("string", m[4]);
        else if (m[5] != null) out += hlSpan("entity", m[5]);
        else out += hlSpan("tag", m[6]);
        last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
}

function hlMarkdown(text) {
    const re = /(^#{1,6} .*$)|(```[\s\S]*?```|`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(!?\[[^\]\n]*\]\([^)\n]*\))|(^\s*(?:[-*+]|\d+[.)]) )/gm;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out += escapeHtml(text.slice(last, m.index));
        if (m[1] != null) out += hlSpan("heading", m[1]);
        else if (m[2] != null) out += hlSpan("code", m[2]);
        else if (m[3] != null) out += hlSpan("bold", m[3]);
        else if (m[4] != null) out += hlSpan("link", m[4]);
        else out += hlSpan("list", m[5]);
        last = re.lastIndex;
    }
    return out + escapeHtml(text.slice(last));
}

function extKind(path) {
    if (!path) return "default";
    const base = String(path).split("/").pop();
    const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
    return FILE_KINDS[ext] || "default";
}

function highlightCode(text, kind) {
    if (text.length > 400000) return escapeHtml(text);
    try {
        if (kind === "js") return hlClike(text, HL_KEYWORDS.js);
        if (kind === "ts") return hlClike(text, HL_KEYWORDS.ts);
        if (kind === "json") return hlClike(text, HL_KEYWORDS.json);
        if (kind === "py") return hlPython(text);
        if (kind === "lua") return hlLuau(text);
        if (kind === "css") return hlCss(text);
        if (kind === "html") return hlHtml(text);
        if (kind === "md") return hlMarkdown(text);
    } catch {
        // en cas d'erreur de coloration, on retombe sur le texte brut
    }
    return escapeHtml(text);
}

function syncHighlightScroll() {
    if (!highlightEl) return;
    highlightEl.scrollTop = code.scrollTop;
    highlightEl.scrollLeft = code.scrollLeft;
}

function syncHighlight() {
    if (!highlightEl) return;
    const tab = currentTab();
    if (!tab) {
        highlightEl.textContent = "";
        return;
    }
    const kind = extKind(tab.path);
    if (kind === "default" || kind === "img") {
        highlightEl.textContent = code.value;
    } else {
        highlightEl.innerHTML = `${highlightCode(code.value, kind)}\n`;
    }
    syncHighlightScroll();
}

let highlightFrame = null;

function scheduleHighlight() {
    if (highlightFrame) return;
    highlightFrame = requestAnimationFrame(() => {
        highlightFrame = null;
        syncHighlight();
    });
}

