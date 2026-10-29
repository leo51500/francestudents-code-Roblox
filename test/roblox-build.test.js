"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseXmlTree, stats, inspectBuild } = require("../desktop/roblox-build");

const PLACE = `<?xml version="1.0" encoding="utf-8"?>
<roblox version="4">
<Item class="DataModel" referent="RBX0">
  <Properties><string name="Name">MonJeu</string></Properties>
  <Item class="Workspace" referent="RBX1">
    <Properties><string name="Name">Workspace</string></Properties>
    <Item class="Part" referent="RBX2">
      <Properties><string name="Name">Sol</string></Properties>
    </Item>
    <Item class="MeshPart" referent="RBX3">
      <Properties><string name="Name">Coffre</string></Properties>
    </Item>
  </Item>
  <Item class="ServerScriptService" referent="RBX4">
    <Properties><string name="Name">ServerScriptService</string></Properties>
    <Item class="Script" referent="RBX5">
      <Properties><string name="Name">Porte</string></Properties>
    </Item>
  </Item>
  <Item class="ReplicatedStorage" referent="RBX6">
    <Properties><string name="Name">ReplicatedStorage</string></Properties>
    <Item class="RemoteEvent" referent="RBX7">
      <Properties><string name="Name">OuvrirPorte</string></Properties>
    </Item>
  </Item>
</Item>
</roblox>`;

function withFile(content, ext, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-rbxlx-"));
  const file = path.join(dir, `game${ext}`);
  fs.writeFileSync(file, content);
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("roblox_build : hiérarchie et noms correctement reconstruits", () => {
  const tree = parseXmlTree(PLACE);
  assert.equal(tree.length, 1);
  const dataModel = tree[0];
  assert.equal(dataModel.className, "DataModel");
  assert.equal(dataModel.name, "MonJeu");
  assert.equal(dataModel.children.length, 3);
  const workspace = dataModel.children[0];
  assert.equal(workspace.name, "Workspace");
  assert.deepEqual(workspace.children.map(node => node.name), ["Sol", "Coffre"]);
  assert.equal(dataModel.children[1].children[0].className, "Script");
});

test("roblox_build : comptages parts, meshes, scripts et remotes", () => {
  const counts = stats(parseXmlTree(PLACE));
  assert.equal(counts.instances, 8);
  assert.equal(counts.parts, 1);
  assert.equal(counts.meshParts, 1);
  assert.equal(counts.scripts, 1);
  assert.equal(counts.remotes, 1);
});

test("roblox_build : un fichier .rbxlx valide renvoie un résumé lisible", () => {
  const report = withFile(PLACE, ".rbxlx", inspectBuild);
  assert.equal(report.valid, true);
  assert.match(report.message, /8 instance\(s\)/);
  assert.match(report.message, /1 part\(s\)/);
  assert.equal(report.tree[0].name, "MonJeu");
});

test("roblox_build : un fichier qui n'est pas une place Roblox est refusé", () => {
  const report = withFile("<html>nope</html>", ".rbxlx", inspectBuild);
  assert.equal(report.valid, false);
  assert.match(report.error, /roblox/);
});

test("roblox_build : un format inattendu est refusé avec un message clair", () => {
  const report = withFile("test", ".txt", inspectBuild);
  assert.equal(report.valid, false);
  assert.match(report.error, /Format attendu/);
});
