"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const skills = require("../src/skills");

function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "fs-skills-auto-"));
}



test("use_skill : un skill de la bibliothèque est installé à la volée puis servi", async () => {
    const userDir = tmpDir();
    const previous = process.env.FS_SKILLS_DIR;
    process.env.FS_SKILLS_DIR = userDir;
    try {
        const tool = require("../src/skills/tool");
        // La bibliothèque est cherchée par le nom du frontmatter (blender-optimize).
        const result = await tool.run({ name: "blender-optimize" });
        assert.equal(result.name, "blender-optimize");
        assert.match(result.instructions, /triangles/i);
        assert.deepEqual(result.files, []);
        assert.ok(fs.existsSync(path.join(result.dir, "SKILL.md")));
    } finally {
        if (previous === undefined) delete process.env.FS_SKILLS_DIR;
        else process.env.FS_SKILLS_DIR = previous;
        fs.rmSync(userDir, { recursive: true, force: true });
    }
});

test("catalogue code : les skills Roblox sont proposés, les skills motion restent séparés", async () => {
    const userDir = tmpDir();
    const previous = process.env.FS_SKILLS_DIR;
    process.env.FS_SKILLS_DIR = userDir;
    try {
        const code = await skills.catalog(null, "code");
        assert.match(code, /roblox-datastore/);
        assert.match(code, /blender-model/);
        const motion = await skills.catalog(null, "effectcraft");
        assert.doesNotMatch(motion, /roblox-datastore/);
    } finally {
        if (previous === undefined) delete process.env.FS_SKILLS_DIR;
        else process.env.FS_SKILLS_DIR = previous;
        fs.rmSync(userDir, { recursive: true, force: true });
    }
});

test("setSkillDisabled : un skill de la bibliothèque est installé avant d'être désactivé", async () => {
    const userDir = tmpDir();
    const previous = process.env.FS_SKILLS_DIR;
    process.env.FS_SKILLS_DIR = userDir;
    try {
        const result = await skills.setSkillDisabled("roblox-ui", true);
        assert.equal(result.disabled, true);
        assert.equal(result.changed, true);
        await assert.rejects(() => skills.getSkill("roblox-ui"), /désactivé/);
    } finally {
        if (previous === undefined) delete process.env.FS_SKILLS_DIR;
        else process.env.FS_SKILLS_DIR = previous;
        fs.rmSync(userDir, { recursive: true, force: true });
    }
});
