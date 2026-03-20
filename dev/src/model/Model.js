// @ts-check

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
 */

/**
 * Stimuli passés au modèle.
 * @typedef {Stimulus[]} Stimuli
 */

/**
 * Nombre de fois où le modèle est passé d'une lettre à la suivante.
 * @typedef {Object} Practice
 * @property {string} lettre - Lettre à laquelle on fait plus 1
 * @property {number} nombre - Nombre de fois où on est passé de cette lettre à la suivante
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
    this.practice = {
        lettre: "A",
        nombre: 0
    };
  }

  /**
   * Fonction qui calcule le temps de résolution pour une 
   * équation (un stimulus) avec une stratégie de comptage
   * @param {Stimulus} stimulus
   * @returns {number} Temps en ms
   */
  calculCountingTime(stimulus) {
    //TODO
    const fraction = -(this.practice.nombre)/this.paramsEstim.delta ;
    const exp = Math.exp(fraction)
    const multiplication = this.paramsEstim.beta * exp;
    const countingTime = this.paramsEstim.alpha + multiplication;
    return countingTime;
  }

  /**
   * Fonction qui calcule le temps de résolution pour une 
   * équation (un stimulus) avec une stratégie de récupération en mémoire
   * @param {Stimulus} stimulus
   * @returns {number} Temps en ms
   */
  calculRetrievalTime(stimulus) {
    //TODO
    const assoStrength = 0;
    const fraction = -(assoStrength)/this.paramsEstim.rho ;
    const exp = Math.exp(fraction)
    const multiplication = this.paramsEstim.tau * exp;
    const retrievalTime = this.paramsEstim.eta + multiplication;
    return retrievalTime;
  }

    /**
   * La fonction permet de calculer le temps de réponse
   * pour un stimulus avec la stratégie optimale
   * @param {Stimulus} stimulus
   * @returns {number} - Renvoie le temps minimum entre les 
   * deux stratégies en ms
   */
  timeWithBestStrategy(stimulus) {
    // TODO
    const countingTime = this.calculCountingTime(stimulus);
    const retrievalTime = this.calculRetrievalTime(stimulus);
    if(countingTime < retrievalTime) {
        return countingTime;
    } else {
        return retrievalTime;
    }
  }

      /**
   * La fonction calcule le temps de réponse
   * de chaque stimulus
   * @param {Stimuli} stimuli
   * @returns {[]} resultats - Renvoie un tableau de résultats
   */
  calculEveryStimuli(stimuli) {
    // TODO
    stimuli.forEach(stimulus => {
        this.timeWithBestStrategy(stimulus);
    });
    return ;
  }

}
