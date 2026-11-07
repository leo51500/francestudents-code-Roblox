"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {checkPortableRelease,configuredRepository}=require("../desktop/startup-updates");
const {createUpdateController}=require("../desktop/updates");
test("startup checks keep automatic downloads enabled and install the update when the app closes",async()=>{
    const {EventEmitter}=require("node:events"),updater=new EventEmitter();let downloads=0,checks=0;
    updater.checkForUpdates=async()=>{checks++;assert.equal(updater.autoDownload,true);updater.emit("update-available",{version:"1.1.4"});if(updater.autoDownload)await updater.downloadUpdate();};
    updater.downloadUpdate=async()=>{downloads++;updater.emit("download-progress",{percent:50});updater.emit("update-downloaded",{version:"1.1.4"});};
    const controller=createUpdateController({updater,enabled:true,version:"1.1.3"});
    assert.equal(updater.autoInstallOnAppQuit,true);
    assert.equal((await controller.action("check")).status,"downloaded");assert.equal(downloads,1);assert.equal(updater.autoDownload,true);
    assert.equal((await controller.action("check")).status,"downloaded");assert.equal(downloads,1);assert.equal(checks,1);
    await controller.action("download");assert.equal(downloads,1);
});

test("NSIS installs per user in one click without an installation-scope prompt",()=>{
    const {build:{nsis}}=require("../package.json");
    assert.equal(nsis.oneClick,true);
    assert.equal(nsis.perMachine,false);
    assert.equal(nsis.allowElevation,false);
    assert.equal(nsis.allowToChangeInstallationDirectory,undefined);
});

test("portable checks stable releases without downgrading or installing",async()=>{
    for(const [tag,status] of [["v1.1.3","available"],["v1.1.2","current"],["v1.1.1","current"],["v1.10.0","available"]]){
        const result=await checkPortableRelease("1.1.2",async(url,options)=>{assert.match(url,/leo51500\/francestudents-code-Roblox\/releases\/latest$/);assert.ok(options.signal);return Response.json({tag_name:tag});});
        assert.equal(result.status,status);
    }
    await assert.rejects(checkPortableRelease("1.1.2",async()=>Response.json({tag_name:"v2.0.0",prerelease:true})),/invalide/);
    await assert.rejects(checkPortableRelease("1.1.2",async()=>new Response("offline",{status:503})),/indisponible/);
});

test("the fork GitHub repository is the only update source",async()=>{
    const repository={owner:"leo51500",repo:"francestudents-code-Roblox"};
    assert.deepEqual(configuredRepository(),repository);
    assert.deepEqual(configuredRepository({FS_UPDATE_OWNER:"other-owner",FS_UPDATE_REPO:"other-repo"}),repository);
    const result=await checkPortableRelease("0.1.0",async(url)=>{assert.match(url,/leo51500\/francestudents-code-Roblox\/releases\/latest$/);return Response.json({tag_name:"v0.2.0"});});
    assert.equal(result.status,"available");
    assert.equal(result.canInstall,false);
    assert.match(result.downloadUrl,/github\.com\/leo51500\/francestudents-code-Roblox\/releases\/latest$/);
});

test("update controller stays unavailable when no source is configured",async()=>{
    const controller=createUpdateController({enabled:false});
    assert.equal((await controller.action("status")).status,"unavailable");
    assert.match((await controller.action("status")).message,/Aucune source de mise à jour/);
    assert.equal((await controller.action("check")).status,"unavailable");
});

test("portable controller shares concurrent checks and never enables installation",async()=>{
    let resolve,calls=0;
    const controller=createUpdateController({enabled:false,version:"1.1.2",checkRelease:()=>{calls++;return new Promise(done=>{resolve=done;});}});
    const one=controller.action("check"),two=controller.action("check");
    await Promise.resolve();assert.equal(calls,1);
    resolve({status:"available",availableVersion:"1.1.3",message:"Manual update"});
    await Promise.all([one,two]);
    const result=await controller.action("install");assert.equal(result.canInstall,false);assert.equal(result.status,"available");
});

test("offline startup check returns an error and allows later retry",async()=>{
    let offline=true;
    const controller=createUpdateController({checkRelease:async()=>{if(offline)throw Error("offline");return {status:"current"};}});
    assert.equal((await controller.action("check")).status,"error");offline=false;
    assert.equal((await controller.action("check")).status,"current");
});
