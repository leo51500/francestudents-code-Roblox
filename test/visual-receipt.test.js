"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {receiptPrompt,readReceipt}=require("../src/api/visual-receipt");
const receipt={images:[{index:1,status:"seen",description:'Un panneau bleu avec le texte "Accueil" et une zone {centrale}.'}]};
test("visual receipt prompt applies to each new image batch",()=>{
    for(const count of [1,2]){
        const prompt=receiptPrompt(count);
        assert.match(prompt,/RÉCEPTION VISUELLE/);
        assert.match(prompt,/ne les décris pas à nouveau/);
        assert.doesNotMatch(prompt,/INITIALE|une seule fois/);
    }
});
test("visual receipt accepts fenced, wrapped and prose-surrounded JSON",()=>{
    const json=JSON.stringify(receipt);
    for(const response of [json,`Voici la capture :\n\`\`\`json\n${json}\n\`\`\`\nFin.`,JSON.stringify({message:json})]){
        assert.deepEqual(readReceipt(response,1),[receipt.images[0].description]);
    }
});
test("visual receipt accepts harmless protocol variants",()=>{
    const description=receipt.images[0].description;
    for(const response of [
        JSON.stringify([{index:1,status:"seen",description}]),
        JSON.stringify({images:[{index:"1",status:"ok",description}]}),
        JSON.stringify({images:[{status:"visible",description}]}),
        JSON.stringify(JSON.stringify({images:[{index:1,status:"seen",description}]}))
    ]) assert.deepEqual(readReceipt(response,1),[description]);
});
test("visual receipt tolerates the JSON defects models actually produce",()=>{
    for(const response of [
        // retour à la ligne brut dans la description
        '{"images":[{"index":1,"status":"seen","description":"Un panneau bleu\navec le texte Accueil et une zone centrale"}]}',
        // virgules finales
        '{"images":[{"index":1,"status":"seen","description":"Un panneau bleu avec le texte Accueil et une zone centrale",},]}',
        // enveloppe imbriquée et description structurée
        '{"receipt":{"images":[{"index":1,"status":"seen","description":{"text":"Un panneau bleu avec le texte Accueil","couleurs":"bleu pâle"}}]}}',
        // description en plusieurs phrases
        '{"images":[{"status":"seen","description":["Un panneau bleu avec le texte Accueil","et une zone centrale"]}]}',
        // réponse tronquée par la limite de sortie
        '{"images":[{"index":1,"status":"seen","description":"Un panneau bleu avec le texte Accueil et une zone centrale'
    ]) assert.match(readReceipt(response,1)[0],/Accueil/);
});
test("visual receipt never treats prose or unavailable pixels as confirmed vision",()=>{
    assert.throws(()=>readReceipt("Je vais examiner la capture.",1),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt(JSON.stringify({images:[{index:1,status:"unavailable",description:"Pixels inaccessibles"}]}),1),error=>error.status===400&&!error.receiptFormat);
    assert.throws(()=>readReceipt(JSON.stringify({images:[{index:1,status:"unreadable",description:"Pixels inaccessibles"}]}),1),error=>error.status===400&&!error.receiptFormat);
    assert.throws(()=>readReceipt(JSON.stringify(receipt),2),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt(JSON.stringify({...receipt,images:[{...receipt.images[0],index:2}]}),1),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt('{"images":[null]}',1),error=>error.receiptFormat===true);
    // Une description trop courte ou un status absent ne prouvent rien.
    assert.throws(()=>readReceipt(JSON.stringify({images:[{status:"seen",description:"court"}]}),1),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt(JSON.stringify({images:[{index:1,description:"Un panneau bleu bien décrit."}]}),1),error=>error.receiptFormat===true);
});
