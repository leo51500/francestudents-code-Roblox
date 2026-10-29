"use strict";
// Hook electron-builder (build.afterPack) : allège l’application Windows.
//
// 1. onnxruntime-node est livré avec les binaires Linux, macOS et ARM64 alors
//    que l’application est distribuée uniquement pour Windows 64 bits. Les
//    supprimer ici ne change rien à la dictée locale, qui reste en CPU.
// 2. onnxruntime-web embarque quatre variantes WebAssembly ; seule la variante
//    SIMD multithread (CPU) est chargée par le worker de dictée.
//
// Le dossier source d’onnxruntime-node reste intact : ce hook ne modifie que la
// copie de build, avant la création de l’installateur.
const fs = require("fs");
const path = require("path");

// Variantes conservées (CPU) d’onnxruntime-web. Les variantes asyncify, JSEP
// (WebGPU) et JSPI (Async WebAssembly) ne sont jamais demandées.
const WEB_WASM_KEEP = /^ort-wasm-simd-threaded(\.mjs|\.js)?$/;

function remove(target) {
  if (!fs.existsSync(target)) return 0;
  const before = fs.statSync(target).isDirectory() ? dirSize(target) : fs.statSync(target).size;
  fs.rmSync(target, { recursive: true, force: true });
  return before;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

function modulesDir(appOutDir) {
  // asar désactivé : <appOutDir>/resources/app/node_modules
  // asar activé  : <appOutDir>/resources/app.asar.unpacked/node_modules
  const candidates = [
    path.join(appOutDir, "resources", "app", "node_modules"),
    path.join(appOutDir, "resources", "app.asar.unpacked", "node_modules")
  ];
  return candidates.find(dir => fs.existsSync(path.join(dir, "onnxruntime-node"))) || null;
}

async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const root = modulesDir(context.appOutDir);
  if (!root) return;
  let freed = 0;

  // Binaires natifs : on ne garde que win32/x64. DirectML et son compilateur
  // de shaders servent l’exécution GPU ; la dictée locale tourne en CPU
  // (device:"cpu" dans desktop/local-speech-engine.js) et ne les charge pas.
  const bin = path.join(root, "onnxruntime-node", "bin");
  const keep = /^(onnxruntime\.dll|onnxruntime_binding\.node)$/i;
  if (fs.existsSync(bin)) {
    for (const variant of fs.readdirSync(bin)) {
      const variantDir = path.join(bin, variant);
      if (!fs.statSync(variantDir).isDirectory()) continue;
      for (const osName of fs.readdirSync(variantDir)) {
        const osDir = path.join(variantDir, osName);
        if (!fs.statSync(osDir).isDirectory()) continue;
        for (const arch of fs.readdirSync(osDir)) {
          const archDir = path.join(osDir, arch);
          if (!fs.statSync(archDir).isDirectory()) continue;
          if (osName !== "win32" || arch !== "x64") {
            freed += remove(archDir);
            continue;
          }
          for (const file of fs.readdirSync(archDir)) {
            if (keep.test(file)) continue;
            freed += remove(path.join(archDir, file));
          }
        }
      }
    }
  }

  // WebAssembly : on ne garde que la variante CPU utilisée par le worker.
  // Le paquet est ignoré s’il reste enfermé dans app.asar : les .wasm n’y
  // seraient pas extractibles et ne pèsent donc que par leur exécutable.
  const dist = path.join(root, "onnxruntime-web", "dist");
  if (fs.existsSync(dist)) {
    for (const file of fs.readdirSync(dist)) {
      // Les .mjs de chaque variante portent le même nom que leur .wasm, plus
      // les cartes de source ; tout ce qui n’est pas la variante CPU part.
      const variant = file.replace(/\.(wasm|mjs|js|map)$/, "");
      if (WEB_WASM_KEEP.test(variant)) continue;
      freed += remove(path.join(dist, file));
    }
  }

  console.log(`[afterPack] ${Math.round(freed / 1024 / 1024)} Mo de binaires inutilisés retirés de l’application Windows.`);
}

module.exports = afterPack;
module.exports.afterPack = afterPack;
