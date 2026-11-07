"use strict";
// Keep only the welcome summary for the current project version.
const releases={
    "0.1.13":{headline:"Un espace Roblox + Blender, un lanceur et des notifications.",items:[
        {icon:"tools",title:"Pipeline Roblox + Blender",text:"Des skills et connexions MCP intégrés accompagnent la création dans Blender, les LOD, l’upload et l’insertion dans Studio."},
        {icon:"spark",title:"Applications et fichiers",text:"Détecte et ouvre les applications Windows, puis ouvre un fichier ou dossier dans VS Code, l’Explorateur ou une autre application."},
        {icon:"chat",title:"Notification sonore",text:"Quand l’application n’est pas au premier plan, une notification Windows signale la fin d’une tâche."}
    ]},
    "0.1.10":{headline:"Les mises à jour gardent leur confirmation Windows.",items:[
        {icon:"tools",title:"Téléchargement automatique conservé",text:"Les mises à jour continuent de se télécharger en arrière-plan."},
        {icon:"shield",title:"Confirmation de l’installateur",text:"À l’installation, la fenêtre Windows reste visible pour confirmer le lancement de l’installateur."},
        {icon:"spark",title:"Pas de certificat requis pour ce changement",text:"Le comportement interactif permet de répondre à Windows sans modifier la signature des versions."}
    ]},
    "0.1.9":{headline:"Une conversation plus claire et plus agréable.",items:[
        {icon:"chat",title:"Chat repensé",text:"Les messages, les réponses et le code sont mieux espacés dans une conversation recentrée."},
        {icon:"spark",title:"Saisie plus confortable",text:"La zone de saisie et ses outils sont regroupés dans un panneau compact, adapté aux petites fenêtres."},
        {icon:"tools",title:"Boutons mieux ajustés",text:"Les icônes sont centrées et les boutons restent dans les limites de leur conteneur."}
    ]},
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
