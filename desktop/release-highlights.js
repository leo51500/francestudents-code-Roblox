"use strict";
// Keep only the welcome summary for the current project version.
const releases={
    "1.25.0":{headline:"Bienvenue dans France-Students-code-Roblox.",items:[
        {icon:"spark",title:"Un espace pour coder",text:"Retrouve l’éditeur, les fichiers et le terminal dans une seule application."},
        {icon:"tools",title:"Un assistant à tes côtés",text:"Explore, modifie et vérifie ton code avec un agent intégré."},
        {icon:"chat",title:"Roblox + Blender",text:"Crée tes modèles dans Blender, puis intègre-les dans Roblox Studio."}
    ]}
};
function createReleaseHighlights({version,enabled=true,load,save}){
    return {
        get(){const content=releases[version] || {headline:"Découvre ton environnement de programmation.",items:[{icon:"spark",title:"Outils réunis",text:"L’éditeur, l’agent, les fichiers et le terminal t’accompagnent dans tes projets."}]};const settings=load();return {version,...content,shouldShow:enabled && settings.releaseHighlightsSeen!==version,showFileVersionsIntro:enabled && settings.fileVersionsIntroSeen!==true,url:null};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;},
        seenFileVersions(){save({fileVersionsIntroSeen:true});return true;}
    };
}
module.exports={createReleaseHighlights};
