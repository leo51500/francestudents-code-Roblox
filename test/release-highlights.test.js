"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createReleaseHighlights}=require("../desktop/release-highlights");
test("release highlights appear once per version and preserve settings",()=>{
    let saved={existing:"keep"};
    const make=(version,enabled=true)=>createReleaseHighlights({version,enabled,load:()=>saved,save:value=>Object.assign(saved,value)});
    const current=make("0.1.0");assert.equal(current.get().shouldShow,true);assert.equal(current.get().items.length,3);assert.equal(current.get().url,null);
    assert.throws(()=>current.seen("9.0.0"),/invalide/);assert.equal(current.get().shouldShow,true);
    current.seen("0.1.0");assert.equal(make("0.1.0").get().shouldShow,false);assert.equal(saved.existing,"keep");
    assert.equal(make("99.0.0").get().shouldShow,true);assert.equal(make("99.0.0").get().items.length,1);
    assert.equal(make("99.0.0",false).get().shouldShow,false);
});
