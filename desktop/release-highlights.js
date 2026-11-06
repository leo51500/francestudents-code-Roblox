"use strict";
// Keep only the welcome summary for the current project version.
const releases={
    "0.1.8":{headline:"Des animations discrètes et des mises à jour plus simples.",items:[
        {icon:"spark",title:"Animations plus fluides",text:"Les messages, panneaux, menus et indicateurs apparaissent en douceur, avec respect de la réduction des animations."},
        {icon:"tools",title:"Mise à jour sans assistant",text:"Les nouvelles versions téléchargées s’installent sans afficher la fenêtre NSIS à chaque mise à jour."},
        {icon:"shield",title:"Installation après fermeture",text:"L’installation reste déclenchée par la mise à jour téléchargée et la fermeture de l’application."}
    ]},
    "0.1.7":{headline:"Une interface plus lisible et personnalisable.",items:[
        {icon:"spark",title:"Zoom au clavier",text:"Ctrl++ et Ctrl+- ajustent le zoom ; Ctrl+0 le réinitialise. Le réglage est mémorisé."},
        {icon:"chat",title:"Mode de réponse visible",text:"Choisis Auto, Agent ou Discussion près de la zone de saisie et consulte une explication de chaque mode."},
        {icon:"tools",title:"Interface et icône affinées",text:"L’interface est plus sombre et l’icône Windows n’a plus de fond noir opaque."}
    ]},
    "0.1.3":{headline:"Correction du crash au démarrage.",items:[
        {icon:"bug",title:"Crash de démarrage corrigé",text:"Le nom du produit est maintenant chargé avec une vérification sûre pour éviter l’erreur au lancement."},
        {icon:"shield",title:"Protection des données de configuration",text:"Un fallback est appliqué si la section build manque dans le package."},
        {icon:"spark",title:"Mise à jour de stabilité",text:"L’application reprend normalement son démarrage sans blocage immédiat."}
    ]},
    "0.1.0":{headline:"Le projet repart sur une nouvelle base.",items:[
        {icon:"spark",title:"Une reprise par GAB DESING",text:"Le projet est maintenant modifié et maintenu par GAB DESING."},
        {icon:"tools",title:"Le code fonctionnel est conservé",text:"Les fonctions existantes restent la base de cette version."},
        {icon:"chat",title:"Les crédits d’origine sont préservés",text:"Les auteurs, crédits et licences d’origine restent inchangés."}
    ]}
};
function createReleaseHighlights({version,enabled=true,load,save}){
    return {
        get(){const content=releases[version] || {headline:"Ton IDE continue de s’améliorer.",items:[{icon:"spark",title:"Améliorations et correctifs",text:"Consulte le journal des modifications du projet."}]};const settings=load();return {version,...content,shouldShow:enabled && settings.releaseHighlightsSeen!==version,showFileVersionsIntro:enabled && settings.fileVersionsIntroSeen!==true,url:null};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;},
        seenFileVersions(){save({fileVersionsIntroSeen:true});return true;}
    };
}
module.exports={createReleaseHighlights};
