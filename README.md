# Modélisation de l'apprentissage arithmétique 

## Objectifs
Cette application a pour but de simuler les temps mis pour trouver les résultats d'équations d'arithmétique alphabétique (exemple : A+2=C). 
Le deuxième objectif est de pouvoir trouver les paramètres d'entrée optimum afin d'obtenir des temps qui se rapprochent le plus des données des participants déjà existantes.
Pour ce faire nous nous sommes basés sur le modèle d'apprentissage figurant dans la thèse de Stéphanie Chouteau (2024). 
L'objectif de cette application est également de donner une visualisation graphique des résultats.

## Fonctionnalités  principales
- Générer des listes d'équations
- Importer des données d'un participant
- Lancer des estimations de paramètres
- Lancer le modèle avec des paramètres configurables
- Exporter les resultats
- Moyennes des temps par session et addend avec un graphique
- Configuration de l'application (configuration des paramètres par défaut)

## Prérequis

### Connaissances sur le sujet
Afin de bien utiliser l'application, il est préférable que vous compreniez les paramètres utilisés pour la modélisation de l'apprentissage arithmétique.

### Prérequis techniques
Vous pouvez aller direrectement sur la github page : https://gatiencaillet.github.io/TER_CAILLET_ILLOUZ/

Ou installer l'application sur votre machine. Il vous faudra NodeJs : https://nodejs.org/en/download

## Installation et lancement de l'application

### Télécharger l'archive (.zip)
Cliquer sur le bouton "<> Code" en vert puis sur le bouton du bas "Download ZIP".
Puis décompresser le dossier dans l'emplacement de votre choix.

### Ouvrir une console et se placer dans le dossier
Sur windows :
```sh
cd {emplacement_du_projet}\TER_CAILLET_ILLOUZ-main\dev}
```
Sur Linux :
```sh
cd {emplacement_du_projet}/TER_CAILLET_ILLOUZ-main/dev}
```

### Installer les dépendances
Grâce à NodeJs, les dépendances peuvent être installlées en une commande :
```sh
npm install
```

### Lancer l'application
Pour lancer l'application il faut éxecuter la commande suivante :
```sh
npm run dev
```
Puis ouvrir un navigateur internet et aller sur l'adresse indiquée après "➜  Local:" 
(exemple : ➜  Local:   http://localhost:5173/)

## Notice d'utilisation
(Pas encore mise)
La notice d'utilisation se trouve dans la partie documentation (/docs/) sous forme de PDF.

## Auteurs et contexte
Nous sommes Gatien CAILLET et Jeanne-Esther ILLOUZ, au moment de la réalisation étudiants en 1ère année de Master Mathématiques et Informatiques Appliquées aux Sciences Humaines et Sociales parcours Informatique et Cognition (MIASHS-IC) à L'Université Grenoble Alpes (UGA). Nous avons réalisé cette application dans le cadre de notre Travail d'Etudes et de Recherches (TER) sous la tutelle de Benoît Lemaire.