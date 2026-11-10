"use strict";

/*
 * Réparation tolérante des réponses du modèle.
 *
 * L'IDE lit la réponse avec JSON.parse. Certains modèles renvoient pourtant un
 * objet approchant : virgule finale, retours à la ligne bruts dans une chaîne,
 * guillemets typographiques, objet tronqué par la limite de sortie, clés
 * synonymes (tool/name, arguments/args) ou type absent. Ce module ramène ces
 * variantes à la forme attendue sans exécuter quoi que ce soit : la validation
 * des outils et des permissions reste faite ensuite par parseAgentResponse.
 */

const TYPE_ALIASES = {
    tool: "tool", tool_call: "tool", toolcall: "tool", call: "tool", action: "tool", outil: "tool", batch: "tool",
    final: "final", final_answer: "final", answer: "final", response: "final", reponse: "final", done: "final", finale: "final", result: "final",
    question: "question", ask: "question", ask_user: "question"
};

const ARGS_ALIASES = ["arguments", "parameters", "params", "input"];
const TYPO_QUOTES = new Set(["\u201C", "\u201D", "\u201E", "\u00AB", "\u00BB"]);
const MESSAGE_ALIASES = ["content", "text", "answer", "response", "report", "summary"];

const asciiKey = value => String(value).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[\s-]+/g, "_");

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Un résultat d'outil recopié par le modèle n'est pas une action. */
function looksLikeObservation(value) {
    return isPlainObject(value) && value.type === undefined && ("ok" in value || "result" in value || "error" in value);
}

/**
 * Réécrit un objet approchant du protocole vers la forme attendue :
 * alias de type, de nom d'outil, d'arguments et de message. Retourne l'objet
 * modifié ; un objet sans rapport avec le protocole est rendu inchangé.
 */
function normalizeActionShape(value) {
    if (!isPlainObject(value) || looksLikeObservation(value)) return value;
    const action = value;

    if (action.name === undefined) {
        if (typeof action.tool === "string") action.name = action.tool;
        else if (isPlainObject(action.tool) && typeof action.tool.name === "string") {
            action.name = action.tool.name;
            if (action.args === undefined && isPlainObject(action.tool.args)) action.args = action.tool.args;
        }
    }
    if (action.args === undefined) {
        for (const key of ARGS_ALIASES) {
            if (isPlainObject(action[key])) { action.args = action[key]; break; }
        }
    }
    if (Array.isArray(action.calls)) {
        action.calls = action.calls.map(call => {
            if (!isPlainObject(call)) return call;
            if (call.name === undefined && typeof call.tool === "string") call.name = call.tool;
            if (call.args === undefined) {
                for (const key of ARGS_ALIASES) {
                    if (isPlainObject(call[key])) { call.args = call[key]; break; }
                }
            }
            return call;
        });
    }

    const alias = typeof action.type === "string" ? TYPE_ALIASES[asciiKey(action.type)] : undefined;
    if (alias) action.type = alias;
    else if (action.type === undefined) {
        // Sans type explicite, on n'infère qu'avec des indices forts : un objet
        // quelconque (contenu de fichier, résultat recopié) ne doit pas devenir une action.
        if (Array.isArray(action.calls) || (typeof action.name === "string" && isPlainObject(action.args))) action.type = "tool";
        else if (typeof action.question === "string") action.type = "question";
        else if (typeof action.message === "string" && typeof action.completed !== "undefined") action.type = "final";
    }

    if (action.type === "final") {
        if (action.message === undefined) {
            for (const key of MESSAGE_ALIASES) {
                if (typeof action[key] === "string") { action.message = action[key]; break; }
            }
        }
        if (typeof action.completed === "string") {
            const flag = action.completed.trim().toLowerCase();
            if (flag === "true") action.completed = true;
            else if (flag === "false") action.completed = false;
        }
    }

    return action;
}

/**
 * Répare un texte JSON approchant : retours à la ligne et tabulations bruts
 * dans les chaînes, guillemets typographiques hors chaîne, virgules finales,
 * chaînes et accolades non fermées (réponse tronquée).
 * Retourne { text, truncated } ; truncated signale une fermeture ajoutée.
 */
function repairJsonText(input) {
    const text = String(input);
    let out = "";
    let inString = false;
    let escaped = false;
    let quote = '"'; // guillemet ayant ouvert la chaîne courante : droit ou typographique
    const stack = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) { escaped = false; out += ch; continue; }
            if (ch === "\\") { escaped = true; out += ch; continue; }
            // Une chaîne ouverte par un guillemet typographique se ferme par un guillemet typographique.
            if (quote === '"' ? ch === '"' : TYPO_QUOTES.has(ch)) { inString = false; out += '"'; continue; }
            if (ch === '"') { out += '\\"'; continue; }
            if (ch === "\n") { out += "\\n"; continue; }
            if (ch === "\r") { out += "\\r"; continue; }
            if (ch === "\t") { out += "\\t"; continue; }
            out += ch;
            continue;
        }

        if (ch === '"' || TYPO_QUOTES.has(ch)) { inString = true; quote = ch; out += '"'; continue; }
        if (ch === "{" || ch === "[") { stack.push(ch === "{" ? "}" : "]"); out += ch; continue; }
        if (ch === "}" || ch === "]") {
            out = out.replace(/,\s*$/, "");
            if (stack.length && stack[stack.length - 1] === ch) stack.pop();
            out += ch;
            continue;
        }
        out += ch;
    }

    let truncated = false;
    if (escaped) { out = out.slice(0, -1); truncated = true; }
    if (inString) { out += '"'; truncated = true; }
    out = out.replace(/,\s*$/, "").replace(/:\s*$/, ":null");
    while (stack.length) { out += stack.pop(); truncated = true; }

    return { text: out, truncated };
}

/**
 * Étend la liste des candidats stricts avec leurs variantes réparées, puis le
 * texte depuis la première accolade (objet tronqué). Les candidats stricts
 * restent en tête : une réponse correcte est lue exactement comme avant.
 */
function expandJsonCandidates(candidates, raw) {
    const text = String(raw ?? "");
    const strict = candidates.map(candidate => ({ text: candidate, truncated: false }));
    const repaired = [];
    const firstBrace = text.indexOf("{");
    const sources = firstBrace === -1 ? candidates : [...candidates, text.slice(firstBrace)];

    for (const source of sources) {
        const fixed = repairJsonText(source);
        if (fixed.text !== source) repaired.push(fixed);
    }

    return [...strict, ...repaired];
}

/** Une réponse sans aucune accolade ne contient pas d'objet : indice utile dans la correction. */
function describeJsonFailure(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return "Réponse vide : aucun objet JSON reçu.";
    if (!raw.includes("{")) return 'Aucun objet JSON {"type":"tool"|"final"} trouvé : la réponse est du texte libre.';
    const fixed = repairJsonText(raw.slice(raw.indexOf("{")));
    if (fixed.truncated) return "Objet JSON tronqué ou incomplet : renvoie l'objet complet, en raccourcissant son contenu si nécessaire.";
    return 'Aucun objet JSON {"type":"tool"|"final"} trouvé.';
}

/**
 * Dernier repli après épuisement des relances : un texte libre, sans aucune
 * accolade ni bloc de code, est présenté comme compte rendu non vérifié
 * (completed:false) plutôt que comme une erreur de protocole.
 */
function proseFinalAction(text) {
    const message = String(text ?? "").trim();
    if (!message || message.includes("{") || message.includes("```")) return null;
    return { type: "final", message, completed: false, unverified: true };
}

/**
 * Refus de capacité : le modèle répond en texte libre qu'il n'a pas accès au
 * projet ou aux outils locaux « depuis cette conversation », alors que les
 * outils locaux sont justement exécutés à partir de l'objet JSON qu'il écrit.
 * Deux indices concordants sont exigés pour éviter les faux positifs
 * (« je n'ai pas accès à la variable X » n'en est pas un).
 */
const CAPABILITY_REFUSAL_PATTERNS = [
    /je n[’']ai (?:pas |aucun |plus |donc pas )?(?:acc[èe]s|d[’']acc[èe]s)/i,
    /je n[’']ai (?:pas|aucun) (?:de |le )?moyen/i,
    /je ne (?:peux|puis) (?:pas |donc pas |malheureusement pas )?(?:effectuer|acc[ée]der|ex[ée]cuter|lancer|lire|modifier|pousser|publier|v[ée]rifier|commit|c[ée]er|construire|g[ée]n[ée]rer|fabriquer|mod[ée]liser|produire|d[ée]velopper)/i,
    /depuis cette (?:conversation|session|interface|discussion)|from this (?:chat|conversation|session)/i,
    /(?:session|environnement|session .{0,40}) disposant/i,
    /outils? (?:locaux|local|de l[’']ide|de fichiers)|local tools?/i,
    /aucune? [^.]{0,40}(?:commit|push|publication|modification|fichier|action|commande)[^.]{0,80}n[’']a (?:été |pas été )?(?:effectu|modifi|ex[ée]cut|lanc|cré)/i,
    /(?:écrire|envoyer|renvoyer)[^.]{0,60}(?:objet json|du json)[^.]{0,80}(?:ne (?:me )?(?:permet|garantit)|pas garanti|sans garantie)/i,
    /\bi (?:don[’']t|do not|cannot|can[’']t) (?:have )?(?:direct )?access/i,
    /no access to (?:the |your )?(?:repo|repository|file|local|tool|project)/i
];

/**
 * Refus explicite de créer un jeu ou un modèle, ou d'exécuter les outils
 * locaux décrits dans la demande. Un seul indice suffit ici : c'est exactement
 * le comportement que l'agent local doit corriger, et il est plus grave de
 * laisser passer ce refus que de relancer une réponse ambiguë.
 */
const GAME_REFUSAL_PATTERNS = [
    /je ne (?:peux|puis) (?:pas |donc pas |malheureusement pas )?(?:cr[ée]er|construire|g[ée]n[ée]rer|fabriquer|mod[ée]liser|produire|d[ée]velopper)[^.]{0,100}(?:jeu|game|roblox|map|niveau|asset|mod[èe]le|3d|blender)/i,
    /(?:cr[ée]er|construire|g[ée]n[ée]rer|fabriquer)[^.]{0,60}(?:jeu|game)[^.]{0,80}(?:pas possible|impossible|hors de (?:ma|mes) (?:port[ée]e|capacit[ée])|ne m[’']est pas)/i,
    /en tant qu[’'](?:ia|assistant|mod[èe]le)[^.]{0,140}(?:pas |impossible)[^.]{0,80}(?:jeu|roblox|3d|blender)/i,
    /(?:cannot|can[’']t|unable to|not able to) (?:create|build|make|generate)[^.]{0,80}(?:game|roblox|3d|model)/i,
    /(?:mais )?pas (?:piloter|ex[ée]cuter|utiliser)[^.]{0,60}(?:agent local|catalogue d[’']outils|outils locaux)/i,
    /catalogue d[’']outils[^.]{0,40}(?:d[ée]crit|non ex[ée]cut|pas ex[ée]cut)/i,
    /(?:outils? (?:locaux|mcp)|roblox_game|roblox_asset)[^.]{0,140}(?:ne sont pas|ne sont|ne seront pas|pas) (?:disponibles|accessibles|ex[ée]cutables|reconnus|activ[ée]s)/i,
    /parmi (?:mes|tes) outils (?:effectifs|natifs|disponibles)/i,
    /ni modifi[ée][^.]{0,80}ni ex[ée]cut[ée][^.]{0,80}ni (?:construit|test[ée]|build)/i
];

/**
 * Une limite qui porte sur une pièce jointe, une image ou une capture ne doit
 * pas être relancée comme si le projet local était inaccessible.
 */
const ATTACHMENT_LIMITATION =
    /(?:pi[èe]ce jointe|fichier joint|attachment|image|photo|capture)[^.]{0,60}(?:outils? locaux|conversation|session|interface)/i;

function looksLikeCapabilityRefusal(text) {
    const raw = String(text ?? "").trim();
    if (!raw || raw.length > 6000 || raw.includes("{")) return false;
    if (ATTACHMENT_LIMITATION.test(raw)) return false;
    if (GAME_REFUSAL_PATTERNS.some(pattern => pattern.test(raw))) return true;
    const hits = CAPABILITY_REFUSAL_PATTERNS.filter(pattern => pattern.test(raw)).length;
    return hits >= 2;
}

/** Correction renvoyée au modèle quand il affirme à tort ne pas avoir d'outils. */
const CAPABILITY_REFUSAL_REMINDER =
    "Tu as répondu en texte libre que le projet, les outils locaux ou la création d'un jeu étaient inaccessibles. " +
    "C'est inexact : les outils du catalogue (read_file, run_command, roblox_game, roblox_asset, mcp_call, …) sont exécutés LOCALEMENT par francestudents-code-Roblox à partir de l'objet JSON que tu écris, " +
    "même si ton fournisseur ne propose pas d'outil natif. Leur absence de la liste des outils natifs est normale : ce ne sont pas des function_calls. " +
    "roblox_game crée réellement le projet Rojo, les systèmes Luau et le build .rbxlx ; roblox_asset fait construire les modèles par Blender. " +
    "Ne conclus jamais à une absence d'accès ou d'outil sans résultat d'outil qui confirme un échec. " +
    'Réponds uniquement par un objet JSON {"type":"tool",...} demandant l\'outil adapté (par exemple roblox_game action:init avec le nom et les systèmes du jeu). ' +
    'Forme exacte attendue, sans texte autour : {"type":"tool","name":"roblox_game","args":{"action":"init","name":"La Ville Vivante","genre":"adventure","systems":["inventory","combat"]},"reason":"Créer le projet du jeu"}.';

module.exports = { normalizeActionShape, repairJsonText, expandJsonCandidates, describeJsonFailure, proseFinalAction, looksLikeCapabilityRefusal, CAPABILITY_REFUSAL_REMINDER };
