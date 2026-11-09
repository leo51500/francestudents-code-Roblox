"use strict";
// Keep only the notes for the current project version.
const releases={
    "1.25.4":{headline:"Les limites des sauvegardes sont plus claires.",items:[
        {icon:"tools",title:"Versions du projet mieux expliquées",text:"Les sauvegardes locales indiquent clairement qu’elles ne couvrent pas les modifications faites dans Blender ou Roblox Studio."},
        {icon:"tools",title:"Restauration sans ambiguïté",text:"Quand une version ne changerait aucun fichier, le bouton et l’explication le signalent directement."},
        {icon:"chat",title:"Travail externe préservé",text:"Retrouve cette précision dans la liste des versions et au moment de vérifier une restauration."}
    ]},
    "1.25.3":{headline:"Reprends une tâche interrompue par une réponse trop volumineuse.",items:[
        {icon:"chat",title:"Reprise en un clic",text:"Après une réponse fournisseur anormalement volumineuse, reprends la tâche sans perdre les modifications déjà effectuées."},
        {icon:"tools",title:"Diagnostic de flux plus précis",text:"Les détails techniques identifient le type et la taille de l’événement SSE qui a dépassé la limite."},
        {icon:"tools",title:"Travail local conservé",text:"La tâche est suspendue sans annuler les fichiers ou modifications déjà produits."}
    ]},
    "1.25.2":{headline:"Les sauvegardes et les conversations sont plus fiables.",items:[
        {icon:"tools",title:"Sauvegardes plus lisibles",text:"Retrouve uniquement les versions du projet actif et vois combien de fichiers elles contiennent."},
        {icon:"tools",title:"Restauration mieux expliquée",text:"Les retours de lecture, restauration et suppression apparaissent directement dans l’onglet Sauvegardes."},
        {icon:"chat",title:"Reprise après suppression",text:"Si le serveur a supprimé une conversation, ta demande reprend dans un nouveau fil."}
    ]},
    "1.25.1":{headline:"Les sons et les textures rejoignent le pipeline Roblox.",items:[
        {icon:"chat",title:"Sons préparés pour Roblox",text:"Un skill dédié recherche des sons libres de droits, vérifie les licences et prépare les fichiers avant leur upload manuel."},
        {icon:"tools",title:"Textures Blender jusqu’aux LOD",text:"Crée des textures procédurales ou bake des cartes PNG, puis conserve-les sur chaque niveau de détail."},
        {icon:"tools",title:"Intégration vérifiée",text:"L’agent attend l’ID audio Roblox, câble le Sound dans Studio et contrôle les propriétés avant de conclure."}
    ]},
};
function createReleaseHighlights({version,enabled=true,load,save}){
    return {
        get(){const content=releases[version] || {headline:"Découvre ton environnement de programmation.",items:[{icon:"spark",title:"Outils réunis",text:"L’éditeur, l’agent, les fichiers et le terminal t’accompagnent dans tes projets."}]};const settings=load();return {version,...content,shouldShow:enabled && settings.releaseHighlightsSeen!==version,showFileVersionsIntro:enabled && settings.fileVersionsIntroSeen!==true,url:null};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;},
        seenFileVersions(){save({fileVersionsIntroSeen:true});return true;}
    };
}
module.exports={createReleaseHighlights};
