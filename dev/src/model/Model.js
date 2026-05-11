// Alphabet de référence utilisé pour représenter les stimuli
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const DEFAULT_PARAMS_INIT = {
  encodingTime: 80,
  comparisonTime: 200,
  commandTime: 300,
  errorRate: 5,
};

const DEFAULT_PARAMS_ESTIM = {
  alpha: 20,
  beta: 1260,
  delta: 340,
  eta: 270,
  tau: 4800,
  rho: 50,
};

/**
 * Indique si une valeur représente un paramètre d'estimation détaillé
 * Un tel objet peut contenir une valeur fixe, une plage ou un indicateur d'activation
 * @param {any} value
 * @returns {boolean}
 */
function isParameterDescriptor(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    ("enabled" in value || "value" in value || "min" in value || "max" in value || "pas" in value)
  );
}

/**
 * Convertit un objet de paramètres en nombres et applique les valeurs par défaut
 * @param {Object} source
 * @param {Object} defaults
 * @returns {Object}
 */
function normalizeNumericParams(source, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      Number(
        isParameterDescriptor(source?.[key])
          ? source?.[key]?.value ?? defaultValue
          : source?.[key] ?? defaultValue,
      ),
    ]),
  );
}

/**
 * Prépare les paramètres d'estimation sous forme de valeurs uniques ou de plages
 * Quand un paramètre est désactivé, il ne produit qu'une seule valeur
 * @param {Object} source
 * @param {Object} defaults
 * @returns {Object}
 */
function normalizeEstimSearchSpace(source, defaults) {
  const EPS = 1e-9;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const descriptor = source?.[key];

      // Si le paramètre n'est pas activé, on le fige à une seule valeur.
      if (!isParameterDescriptor(descriptor) || !descriptor.enabled) {
        return [
          key,
          [
            Number(
              isParameterDescriptor(descriptor)
                ? descriptor.value ?? defaultValue
                : descriptor ?? defaultValue,
            ),
          ],
        ];
      }

      let minValue = Number(descriptor.min ?? defaultValue);
      let maxValue = Number(descriptor.max ?? defaultValue);
      const rawStep = Number(descriptor.pas ?? 1);
      const stepValue = Math.max(1, Math.abs(rawStep) || 1);

      // Si la borne minimale est supérieure à la borne maximale, on stoppe
      if (minValue > maxValue) {
        throw new Error(
          `Parametre invalide: min (${minValue}) est superieur a max (${maxValue}) pour ${key}.`,
        );
      }

      const span = maxValue - minValue;
      const count = Math.max(1, Math.floor(span / stepValue + EPS) + 1);
      const values = [];

      for (let i = 0; i < count; i++) {
        const v = Number((minValue + i * stepValue).toFixed(10));
        values.push(v);
      }

      // Garantit l'inclusion de la borne max malgré les imprécisions de float
      if (values[values.length - 1] < maxValue - EPS) {
        values.push(Number(maxValue));
      }

      // Évite les doublons si l'arrondi a produit deux valeurs identiques
      const dedup = values.filter((v, idx) => idx === 0 || Math.abs(v - values[idx - 1]) > EPS);
      return [key, dedup];
    }),
  );
}

/**
 * Construit toutes les combinaisons possibles à partir d'une liste de couples [clé, valeurs]
 * Cette fonction sert au grid search pour tester chaque configuration activée
 * @param {Array} entries
 * @param {number} index
 * @param {Object} current
 * @param {Array} output
 * @returns {Array}
 */
function cartesianProduct(entries, index = 0, current = {}, output = []) {
  if (index >= entries.length) {
    output.push({ ...current });
    return output;
  }

  const [key, values] = entries[index];

  values.forEach((value) => {
    current[key] = value;
    cartesianProduct(entries, index + 1, current, output);
  });

  return output;
}

/**
 * Paramètres d'initialisation du modèle
 * @typedef {Object} ParamsInit
 * @property {number} encodingTime - Temps d'encodage (ms)
 * @property {number} comparisonTime - Temps de comparaison (ms)
 * @property {number} commandTime - Temps de commande moteur / clic (ms)
 * @property {number} errorRate - Taux d'erreur en pourcentage (0-100)
 */

/**
 * Paramètres d'estimation du modèle
 * @typedef {Object} ParamsEstim
 * @property {number} alpha - Temps de calcul entre chaque lettre (ms)
 * @property {number} beta - Facteur de durée de comptage
 * @property {number} delta - Taux de la diminution de la durée de réponse selon l'entrainement
 * @property {number} eta - Temps de récupération en mémoire (ms)
 * @property {number} tau - Facteur de récupération en mémoire
 * @property {number} rho - Taux de la diminution du temps de récupération selon la force de l'association
 */

/**
 * Stimulus : Augend, Addend, Result, Time et Session
 * @typedef {Object} Stimulus
 * @property {string} augend - Lettre à gauche de l'équation
 * @property {number} addend - Chiffre à droite de l'équation
 * @property {string} result - Résultat de l'équation
 * @property {number} time - Temps de réponse (ms)
 * @property {number} session - Session d'entraînement
 */

/**
 * Stimuli passés au modèle
 * @typedef {Stimulus[]} Stimuli
 */

/**
 * Dictionnaire de pratique pour chaque lettre : nombre de fois où elle a été pratiquée
 * La clé est la lettre (ex: "A") et la valeur est le nombre de passages
 * @typedef {Object.<string, number>} PracticeMap
 */

/**
 * Force de l'association en mémoire pour une équation complète
 * La clé est au format "Augend+Addend" (ex: "A+3") et la valeur est le nombre de répétitions
 * @typedef {Object.<string, number>} AssociationMap
 */

/**
 * Resultats calculés pour chaque stimulus
 * Chaque objet contient : Augend, Addend, Result, Time, Session
 * @typedef {Object} Resultat
 * @property {string} augend
 * @property {number} addend
 * @property {string} result
 * @property {number} time
 * @property {number} session
 */

/**
 * Liste de resultats calculés pour tous les stimuli
 * @typedef {Resultat[]} Resultats
 */

export class Model {
  /**
   * @param {ParamsInit} paramsInit
   * @param {ParamsEstim} paramsEstim
   * @param {Stimuli} stimuli
   */
  constructor(
    paramsInit = DEFAULT_PARAMS_INIT,
    paramsEstim = DEFAULT_PARAMS_ESTIM,
    stimuli = [],
  ) {
    this.paramsInit = normalizeNumericParams(paramsInit, DEFAULT_PARAMS_INIT);
    this.paramsEstim = normalizeNumericParams(paramsEstim, DEFAULT_PARAMS_ESTIM);
    this.paramsEstimSearchSpace = normalizeEstimSearchSpace(paramsEstim, DEFAULT_PARAMS_ESTIM);
    this.stimuli = stimuli;

    const baseInitTime =
      this.paramsInit.encodingTime +
      this.paramsInit.comparisonTime +
      this.paramsInit.commandTime;

    this.initTime = baseInitTime * (1 + this.paramsInit.errorRate / 100);

    // Dictionnaire de pratique: chaque lettre commence à zéro
    /** @type {PracticeMap} */
    this.practice = {};

    for (let lettre of ALPHABET) {
      this.practice[lettre] = 0;
    }

    // Historique des associations déjà rencontrées
    /** @type {AssociationMap} */
    this.associations = {};

    // Résultats calculés pour chaque stimulus
    /** @type {Resultats} */
    this.results = [];

    // Permettant d'interrompre une estimation en cours par l'utilisateur
    this.shouldAbort = false;
  }
 
  /**
   * Indique si au moins un paramètre d'estimation doit être exploré en grille
   * @returns {boolean}
   */
  hasGridSearchConfiguration() {
    return Object.values(this.paramsEstimSearchSpace).some((values) => values.length > 1);
  }

  /**
   * Retourne le nombre total de combinaisons à tester pour la grille
   * @returns {number}
   */
  countGridSearchCombinations() {
    const entries = Object.entries(this.paramsEstimSearchSpace || {});
    const product = entries.reduce((p, [, values]) => p * Math.max(1, (values || []).length), 1);

    // TODO : Juste bloquer l'estimation si la grille est trop grande et donner un avertissement à l'utilisateur, plutôt que de faire une estimation partielle
    // Si la grille est trop grande, on évite de générer toutes les combinaisons
    const SAFETY_LIMIT = 100000; // Seuil de sécurité pour préserver le navigateur
    if (product <= SAFETY_LIMIT) {
      const candidates = cartesianProduct(entries);
      return candidates.length;
    }

    return product;
  }

  /**
   * Réinitialise l'état interne du modèle avant un nouveau calcul
   * @returns {void}
   */
  resetState() {
    /** @type {PracticeMap} */
    this.practice = {};

    for (let lettre of ALPHABET) {
      this.practice[lettre] = 0;
    }

    /** @type {AssociationMap} */
    this.associations = {};
    /** @type {Resultats} */
    this.results = [];
  }

  /**
   * Crée une nouvelle instance du modèle avec un autre jeu de paramètres d'estimation
   * @param {ParamsEstim} paramsEstim
   * @returns {Model}
   */
  cloneWithParams(paramsEstim) {
    // Chaque essai repart d'un modèle neuf pour ne pas mélanger les états internes
    return new Model(this.paramsInit, paramsEstim, this.stimuli);
  }

  /**
   * Évalue un jeu de paramètres en comparant les temps simulés aux temps observés
   * @param {Stimuli} stimuli
   * @param {ParamsEstim} paramsEstim
   * @returns {{score: number, paramsEstim: ParamsEstim}}
   */
  evaluateParamsSet(stimuli, paramsEstim) {
    const candidateModel = this.cloneWithParams(paramsEstim);

    // Comme il s'agit d'un modèle neuf, l'évaluation ne modifie pas l'instance courante
    candidateModel.calculEveryStimulusTime(stimuli);

    let errorSum = 0;

    // On mesure l'écart entre les temps simulés et les temps observés
    candidateModel.results.forEach((result, index) => {
      const observedTime = Number(stimuli[index]?.time);
      if (!Number.isFinite(observedTime)) {
        throw new Error(
          "Les données importées doivent contenir une colonne Temps numérique pour l'estimation.",
        );
      }

      const delta = result.time - observedTime;
      errorSum += delta * delta;
    });

    return {
      score: Math.sqrt(errorSum / candidateModel.results.length),
      paramsEstim,
    };
  }

  /**
   * Lance une recherche en grille et conserve la configuration qui minimise l'erreur
   * @param {Stimuli} stimuli
   * @param {Function|null} onProgress
   * @param {boolean} collectResults
   * @returns {{bestParams: ParamsEstim, evaluations: Array<{score: number, paramsEstim: ParamsEstim}>}}
   */
  async estimateParamsGrid(stimuli = this.stimuli, onProgress = null, collectResults = false) {
    const searchEntries = Object.entries(this.paramsEstimSearchSpace);

    if (!searchEntries.length || !this.hasGridSearchConfiguration()) {
      if (collectResults) {
        const evaluation = this.evaluateParamsSet(stimuli, this.paramsEstim);
        return { bestParams: this.paramsEstim, evaluations: [evaluation] };
      }
      return { bestParams: this.paramsEstim, evaluations: [] };
    }

    // Génère toutes les combinaisons puis garde celle qui minimise l'erreur
    const candidates = cartesianProduct(searchEntries);
    let bestCandidate = null;
    let processedCount = 0;
    const yieldEvery = Math.max(1, Math.floor(candidates.length / 80));
    const evaluations = collectResults ? [] : null;

    for (let index = 0; index < candidates.length; index += 1) {
      // Interruption demandée par l'utilisateur
      if (this.shouldAbort) {
        throw new Error("Estimation aborted by user");
      }

      const candidate = candidates[index];
      const mergedParams = {
        ...this.paramsEstim,
        ...candidate,
      };
      const evaluation = this.evaluateParamsSet(stimuli, mergedParams);
      if (evaluations) {
        evaluations.push(evaluation);
      }

      if (!bestCandidate || evaluation.score < bestCandidate.score) {
        bestCandidate = evaluation;
      }

      processedCount += 1;
      if (typeof onProgress === 'function') {
        onProgress(processedCount, candidates.length);
      }

      if (processedCount % yieldEvery === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this.paramsEstim = {
      ...this.paramsEstim,
      ...(bestCandidate?.paramsEstim ?? {}),
    };

    this.paramsEstimSearchSpace = normalizeEstimSearchSpace(
      this.paramsEstim,
      DEFAULT_PARAMS_ESTIM,
    );

    return { bestParams: this.paramsEstim, evaluations: evaluations ?? [] };
  }

  /**
   * Lance une recherche en grille et conserve la configuration qui minimise l'erreur
   * @param {Stimuli} stimuli
   * @param {Function|null} onProgress
   * @returns {ParamsEstim}
   */
  async estimateBestParams(stimuli = this.stimuli, onProgress = null) {
    const { bestParams } = await this.estimateParamsGrid(stimuli, onProgress, false);
    return bestParams;
  }

  /**
   * Lance une recherche en grille et retourne aussi le RMSE pour chaque combinaison
   * @param {Stimuli} stimuli
   * @param {Function|null} onProgress
   * @returns {{bestParams: ParamsEstim, evaluations: Array<{score: number, paramsEstim: ParamsEstim}>}}
   */
  async estimateBestParamsWithScores(stimuli = this.stimuli, onProgress = null) {
    return this.estimateParamsGrid(stimuli, onProgress, true);
  }

  /**
   * Vérifie qu'un stimulus contient des valeurs exploitables par le modèle
   * Normalement pas utile car les stimuli sont déjà filtrés par les chercheurs
   * @param {Stimulus} stimulus
   * @returns {void}
   */
  validateStimulus(stimulus) {
    const augend = String(stimulus.augend || "").toUpperCase();
    const addend = Number(stimulus.addend);
    const augendIndex = ALPHABET.indexOf(augend);

    if (augendIndex === -1) {
      throw new Error(
        `Stimulus invalide: augend doit être une lettre entre A et Z (${stimulus.augend})`,
      );
    }

    if (!Number.isInteger(addend) || addend < 0 || addend >= ALPHABET.length) {
      throw new Error(
        `Stimulus invalide: addend doit être un entier entre 0 et 25 (${stimulus.addend})`,
      );
    }

    if (augendIndex + addend >= ALPHABET.length) {
      throw new Error(`Stimulus invalide: ${augend}+${addend} dépasse Z`);
    }
  }

  /**
   * Estime le temps de comptage à partir du dernier stimulus avec le même addend
   * @param {Stimulus} stimulus
   * @returns {number} Temps estimé en ms
   */
  calculCountingTimeEstimation(stimulus) {
    let countingTimeEstimated = 0;

    // Parcourt les stimuli précédents pour trouver le plus récent avec le même addend
    for (let i = this.results.length - 1; i >= 0; i -= 1) {
      if (this.results[i].addend === stimulus.addend) {
        countingTimeEstimated = this.results[i].time;
        break;
      }
    }
    // Si rien n'est trouvé, la stratégie de comptage est considérée comme la plus rapide

    return countingTimeEstimated;
  }

  /**
   * Calcule le temps de résolution par stratégie de comptage
   * Le temps diminue spécifiquement pour chaque lettre pratiquée
   * @param {Stimulus} stimulus
   * @returns {number} Temps estimé en ms
   */
  calculCountingTime(stimulus) {
    let countingTime = 0;
    let currentIdx = ALPHABET.indexOf(stimulus.augend.toUpperCase());

    for (let i = 0; i < stimulus.addend; i += 1) {
      const lettreActuelle = ALPHABET[currentIdx];

      // Nombre de fois où cette lettre a déjà été pratiquée
      const nPratique = this.practice[lettreActuelle];

      // Temps pour passer d'une lettre à la suivante
      const fraction = -nPratique / this.paramsEstim.delta;
      const stepTime =
        this.paramsEstim.alpha + this.paramsEstim.beta * Math.exp(fraction);

      countingTime += stepTime;

      // La pratique de cette lettre augmente après son utilisation
      this.practice[lettreActuelle] += 1;

      currentIdx += 1;
    }

    return countingTime;
  }

  /**
   * Calcule le temps de récupération directe en mémoire
   * Le temps diminue spécifiquement pour chaque équation pratiquée
   * @param {Stimulus} stimulus
   * @returns {number} Temps en ms
   */
  calculRetrievalTime(stimulus) {    
    // On crée une clé unique pour cette équation (ex: "A+3")
    const equationKey = `${stimulus.augend.toUpperCase()}+${stimulus.addend}`;

    // Force d'association déjà connue pour cette équation
    const assoStrength = this.associations[equationKey] || 0;

    // Temps de récupération directe en mémoire
    const fraction = -assoStrength / this.paramsEstim.rho;
    const retrievalTime =
      this.paramsEstim.eta + this.paramsEstim.tau * Math.exp(fraction);

    // La force d'association augmente après la récupération
    this.associations[equationKey] = assoStrength + 1;

    return retrievalTime;
  }

  /**
   * Calcule le temps de réponse total en ajoutant le temps d'initialisation
   * au temps de la stratégie la plus performante
   * @param {Stimulus} stimulus
   * @returns {number} Temps total en ms
   */
  timeWithBestStrategy(stimulus) {
    const countingTimeEstimated = this.calculCountingTimeEstimation(stimulus);
    const retrievalTime = this.calculRetrievalTime(stimulus);

    // On conserve la stratégie la plus rapide
    if (countingTimeEstimated < retrievalTime) {
      return this.initTime + this.calculCountingTime(stimulus);
    }

    return this.initTime + retrievalTime;
  }

  /**
   * La fonction calcule le temps de réponse de chaque stimulus
   * @param {Stimuli} stimuli
   * @returns {void} results - Renvoie un tableau d'objets résultats
   */
  calculEveryStimulusTime(stimuli) {
    // Réinitialise l'état pour éviter qu'un calcul précédent influence le suivant
    this.resetState();

    this.results = [];

    stimuli.forEach((stimulus) => {
      // Chaque stimulus est vérifié avant le calcul
      this.validateStimulus(stimulus);

      // Temps obtenu via la meilleure stratégie disponible
      const calculTime = this.timeWithBestStrategy(stimulus);

      this.results.push({
        augend: stimulus.augend,
        addend: stimulus.addend,
        result: stimulus.result,
        time: calculTime,
        session: stimulus.session,
      });
    });
  }
}
