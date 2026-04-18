// @ts-check

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Paramètres d'initialisation du modèle.
 * @typedef {Object} ParamsInit
 * @property {number} encodingTime - Temps d'encodage (ms)
 * @property {number} comparisonTime - Temps de comparaison (ms)
 * @property {number} commandTime - Temps de commande moteur / clic (ms)
 * @property {number} errorRate - Taux d'erreur en pourcentage (0-100)
 */

/**
 * Paramètres d'estimation du modèle.
 * @typedef {Object} ParamsEstim
 * @property {number} alpha - Temps de calcul entre chaque lettre (ms)
 * @property {number} beta - Facteur de durée de comptage
 * @property {number} delta - Taux de la diminution de la durée de réponse selon l'entrainement
 * @property {number} eta - Temps de récupération en mémoire (ms)
 * @property {number} tau - Facteur de récupération en mémoire
 * @property {number} rho - Taux de la diminution du temps de récupération selon la force de l'association
 */

/**
 * Stimulus : Augend, Addend et Résultat.
 * @typedef {Object} Stimulus
 * @property {string} augend - Lettre à gauche de l'équation
 * @property {number} addend - Chiffre à droite de l'équation
 * @property {string} resultat - Résultat de l'équation
 * @property {number} session - Session d'entraînement
 */

/**
 * Stimuli passés au modèle.
 * @typedef {Stimulus[]} Stimuli
 */

/**
 * Dictionnaire de pratique.
 * La clé est la lettre (ex: "A") et la valeur est le nombre de passages.
 * @typedef {Object.<string, number>} PracticeMap
 */

/**
 * Force de l'association en mémoire pour une équation complète.
 * La clé est au format "Augend+Addend" (ex: "A+3") et la valeur est le nombre de répétitions.
 * @typedef {Object.<string, number>} AssociationMap
 */

/**
 * Resultats calculés pour chaque stimulus.
 * Chaque objet contient : Augend, Addend, Resultat, Temps, Session.
 * @typedef {Object} Resultat
 * @property {string} augend
 * @property {number} addend
 * @property {string} resultat
 * @property {number} temps
 * @property {number} session
 */

/**
 * Liste de resultats calculés pour tous les stimuli.
 * @typedef {Resultat[]} Resultats
 */

export class Model {
  /**
   * @param {ParamsInit} paramsInit
   * @param {ParamsEstim} paramsEstim
   * @param {Stimuli} stimuli
   */
  constructor(
    paramsInit = {
      encodingTime: 80,
      comparisonTime: 200,
      commandTime: 300,
      errorRate: 5,
    },
    paramsEstim = {
      alpha: 20,
      beta: 1260,
      delta: 340,
      eta: 270,
      tau: 4800,
      rho: 50,
    },
    stimuli = [],
  ) {
    this.paramsInit = paramsInit;
    this.paramsEstim = paramsEstim;
    this.stimuli = stimuli;

    this.initTime =
      this.paramsInit.encodingTime +
      this.paramsInit.comparisonTime +
      this.paramsInit.commandTime;

    // Initialisation du dictionnaire de pratique : { "A": 0, "B": 0, ... }
    /** @type {PracticeMap} */
    this.practice = {};

    for (let lettre of ALPHABET) {
      this.practice[lettre] = 0;
    }

    // Initialisation des associations : {"A+3": 5, "B+2": 12, ...}
    /** @type {AssociationMap} */
    this.associations = {};

    // Resultats calculés pour chaque stimulus
    /** @type {Resultats} */
    this.results = [];
  }

  /**
 * Calcule le temps estimé pour la stratégie de comptage en fonction du dernier stimulus avec le même addend.
 * @param {Stimulus} stimulus
 * @returns {number} Temps estimé en ms
 */
  calculCountingTimeEstimation(stimulus) {
    let countingTimeEstimated = 0;

    // parcourir les stimuli précédents pour trouver le dernier stimulus avec le même addend
    for (let i = this.results.length - 1; i >= 0; i--) {
      if (this.results[i].addend === stimulus.addend) {
        countingTimeEstimated = this.results[i].temps;
        break;
      }
    }
    // Si aucun stimulus précédent avec le même addend n'est trouvé, on calculera le temps de comptage 
    // (0 pour faire en sorte que ce soit plus rapide que la récupération en mémoire)

    return countingTimeEstimated;
  }

  /**
   * Calcule le temps de résolution par stratégie de comptage.
   * Le temps diminue spécifiquement pour chaque lettre pratiquée.
   * @param {Stimulus} stimulus
   * @returns {number} Temps estimé en ms
   */
  calculCountingTime(stimulus) {
    let countingTime = 0;
    let currentIdx = ALPHABET.indexOf(stimulus.augend.toUpperCase());

    for (let i = 0; i < stimulus.addend; i++) {
      const lettreActuelle = ALPHABET[currentIdx];

      // On récupère le nombre de fois où le modèle a vu ce calcul
      const nPratique = this.practice[lettreActuelle];

      // Calcul du temps pour le saut (ex: A -> B)
      const fraction = -nPratique / this.paramsEstim.delta;
      const stepTime =
        this.paramsEstim.alpha + this.paramsEstim.beta * Math.exp(fraction);

      countingTime += stepTime;

      // Mise à jour de la pratique pour cette lettre uniquement
      this.practice[lettreActuelle] += 1;

      // On passe à l'index suivant pour le prochain saut de la boucle
      currentIdx++;
    }

    return countingTime;
  }

  /**
   * Calcule le temps de récupération directe en mémoire.
   * @param {Stimulus} stimulus
   * @returns {number} Temps en ms
   */
  calculRetrievalTime(stimulus) {
    // On crée une clé unique pour cette équation (ex: "A+3")
    const equationKey = `${stimulus.augend.toUpperCase()}+${stimulus.addend}`;

    // On récupère la force de l'association (0 si jamais vue)
    const assoStrength = this.associations[equationKey] || 0;

    // Calcul selon ta formule
    const fraction = -assoStrength / this.paramsEstim.rho;
    const retrievalTime =
      this.paramsEstim.eta + this.paramsEstim.tau * Math.exp(fraction);

    // On incrémente la force de l'association
    this.associations[equationKey] = assoStrength + 1;

    return retrievalTime;
  }

  /**
   * Calcule le temps de réponse total en ajoutant le temps d'initialisation
   * au temps de la stratégie la plus performante.
   * @param {Stimulus} stimulus
   * @returns {number} Temps total en ms
   */
  timeWithBestStrategy(stimulus) {
    const countingTimeEstimated = this.calculCountingTimeEstimation(stimulus);
    const retrievalTime = this.calculRetrievalTime(stimulus);

    // On prend le minimum entre les deux stratégies
    if (countingTimeEstimated < retrievalTime) {
      return this.initTime + this.calculCountingTime(stimulus);
    } else {
      return this.initTime + retrievalTime;
    }
  }

  /**
   * La fonction calcule le temps de réponse de chaque stimulus.
   * @param {Stimuli} stimuli
   * @returns {void} resultats - Renvoie un tableau d'objets résultats
   */
  calculEveryStimulusTime(stimuli) {

    stimuli.forEach((stimulus) => {
      // On calcule le temps via la stratégie optimale
      const calculTime = this.timeWithBestStrategy(stimulus);

      this.results.push({
        augend: stimulus.augend,
        addend: stimulus.addend,
        resultat: stimulus.resultat,
        temps: calculTime,
        session: stimulus.session
      });
    });
  }
}
