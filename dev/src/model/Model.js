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

// TODO
/**
 * Vérifie si une valeur est un descripteur de paramètre avec les propriétés attendues (enabled, value, min, max, pas).
 * Cette fonction est utilisée pour différencier les paramètres simples des paramètres d'estimation 
 * qui peuvent être activés pour la recherche en grille.
 * @param {any} value
 * @returns {boolean}
 */
function isParameterDescriptor(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('enabled' in value || 'value' in value || 'min' in value || 'max' in value || 'pas' in value)
  );
}

// TODO
/**
 * Transforme un objet de paramètres en nombres et applique les valeurs par défaut si besoin.
 * @param {Object} source
 * @param {Object} defaults
 * @returns {Object}
 */
function normalizeNumericParams(source, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      Number(isParameterDescriptor(source?.[key]) ? source?.[key]?.value ?? defaultValue : source?.[key] ?? defaultValue),
    ]),
  );
}

// TODO
/**
 * Prépare les paramètres d'estimation sous forme de plages à tester ou de valeurs fixes.
 * Quand un paramètre n'est pas activé, il reste figé sur une seule valeur.
 * @param {Object} source
 * @param {Object} defaults
 * @returns {Object}
 */
function normalizeEstimSearchSpace(source, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const descriptor = source?.[key];

      // Si le paramètre n'est pas activé, on le fige à une seule valeur.
      if (!isParameterDescriptor(descriptor) || !descriptor.enabled) {
        return [key, [Number(isParameterDescriptor(descriptor) ? descriptor.value ?? defaultValue : descriptor ?? defaultValue)]];
      }

      const minValue = Number(descriptor.min ?? defaultValue);
      const maxValue = Number(descriptor.max ?? defaultValue);
      const stepValue = Math.abs(Number(descriptor.pas ?? 1)) || 1;
      const values = [];

      // On parcourt min jusqu'à max avec le pas spécifié .
      for (let current = minValue; current <= maxValue; current += stepValue) {
        values.push(Number(current.toFixed(10)));
      }

      if (!values.length) {
        values.push(Number(descriptor.value ?? defaultValue));
      } else if (values[values.length - 1] !== maxValue) {
        values.push(maxValue);
      }

      return [key, values];
    }),
  );
}

/**
 * Construit toutes les combinaisons possibles à partir d'une liste de couples [clé, valeurs].
 * Cette fonction sert au grid search pour tester chaque configuration activée.
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
 * @property {string} result - Résultat de l'équation
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
 * Chaque objet contient : Augend, Addend, Result, Temps, Session.
 * @typedef {Object} Resultat
 * @property {string} augend
 * @property {number} addend
 * @property {string} result
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

  // TODO
  /**
   * Indique si au moins un paramètre d'estimation doit être exploré en grille.
   * @returns {boolean}
   */
  hasGridSearchConfiguration() {
    return Object.values(this.paramsEstimSearchSpace).some((values) => values.length > 1);
  }

  /**
   * Retourne le nombre total de combinaisons à tester pour la grille.
   * @returns {number}
   */
  countGridSearchCombinations() {
    return Object.values(this.paramsEstimSearchSpace).reduce(
      (product, values) => product * Math.max(1, values.length),
      1,
    );
  }

  /**
   * Réinitialise l'état interne du modèle avant un nouveau calcul.
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
   * Crée une nouvelle instance du modèle avec un autre jeu de paramètres d'estimation.
   * @param {ParamsEstim} paramsEstim
   * @returns {Model}
   */
  cloneWithParams(paramsEstim) {
    // Chaque essai de grille repart d'un modèle neuf pour éviter de mélanger les états internes.
    return new Model(this.paramsInit, paramsEstim, this.stimuli);
  }

  // TODO : il faut comparer a celle du participant ans les imports et pas celle du model
  /**
   * Évalue un jeu de paramètres en comparant les temps simulés aux temps observés.
   * @param {Stimuli} stimuli
   * @param {ParamsEstim} paramsEstim
   * @returns {{score: number, paramsEstim: ParamsEstim}}
   */
  evaluateParamsSet(stimuli, paramsEstim) {
    const candidateModel = this.cloneWithParams(paramsEstim);
    
    // TODO ici le probleme
    candidateModel.calculEveryStimulusTime(stimuli);

    let errorSum = 0;

    // On mesure l'erreur quadratique moyenne entre le temps simulé et le temps observé.
    candidateModel.results.forEach((result, index) => {
      const observedTime = Number(stimuli[index]?.time);
      if (!Number.isFinite(observedTime)) {
        throw new Error('Les données importées doivent contenir une colonne time numérique pour l estimation.');
      }

      const delta = result.temps - observedTime;
      errorSum += delta * delta;
    });

    return {
      score: errorSum / candidateModel.results.length,
      paramsEstim,
    };
  }

  /**
   * Lance une recherche en grille et conserve la configuration qui minimise l'erreur.
   * @param {Stimuli} stimuli
   * @returns {ParamsEstim}
   */
  estimateBestParams(stimuli = this.stimuli) {
    const searchEntries = Object.entries(this.paramsEstimSearchSpace);

    if (!searchEntries.length || !this.hasGridSearchConfiguration()) {
      return this.paramsEstim;
    }

    // On génère toutes les combinaisons des paramètres cochés, puis on garde celle qui minimise l'erreur.
    const candidates = cartesianProduct(searchEntries);
    let bestCandidate = null;

    candidates.forEach((candidate) => {
      const mergedParams = {
        ...this.paramsEstim,
        ...candidate,
      };
      const evaluation = this.evaluateParamsSet(stimuli, mergedParams);

      if (!bestCandidate || evaluation.score < bestCandidate.score) {
        bestCandidate = evaluation;
      }
    });

    this.paramsEstim = {
      ...this.paramsEstim,
      ...(bestCandidate?.paramsEstim ?? {}),
    };

    // TODO verifier que c'est utile
    this.paramsEstimSearchSpace = normalizeEstimSearchSpace(this.paramsEstim, DEFAULT_PARAMS_ESTIM);

    return this.paramsEstim;
  }

  /**
   * Vérifie qu'un stimulus contient des valeurs exploitables par le modèle.
   * Normalement pas utilisé car les stimuli sont déjà filtrés par les chercheurs.
   * @param {Stimulus} stimulus
   * @returns {void}
   */
  validateStimulus(stimulus) {
    const augend = String(stimulus.augend || '').toUpperCase();
    const addend = Number(stimulus.addend);
    const augendIndex = ALPHABET.indexOf(augend);

    if (augendIndex === -1) {
      throw new Error(`Stimulus invalide: augend doit être une lettre entre A et Z (${stimulus.augend})`);
    }

    if (!Number.isInteger(addend) || addend < 0 || addend >= ALPHABET.length) {
      throw new Error(`Stimulus invalide: addend doit être un entier entre 0 et 25 (${stimulus.addend})`);
    }

    if (augendIndex + addend >= ALPHABET.length) {
      throw new Error(`Stimulus invalide: ${augend}+${addend} dépasse Z`);
    }
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
   * Le temps diminue spécifiquement pour chaque équation pratiquée.
   * @param {Stimulus} stimulus
   * @returns {number} Temps en ms
   */
  calculRetrievalTime(stimulus) {    // On crée une clé unique pour cette équation (ex: "A+3")
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
   * @returns {void} results - Renvoie un tableau d'objets résultats
   */
  calculEveryStimulusTime(stimuli) {
    // Avant de calculer les temps, on réinitialise l'état du modèle pour éviter 
    // que les résultats d'une estimation précédente n'influencent les calculs actuels.
    this.resetState();

    this.results = [];

    stimuli.forEach((stimulus) => {
      // On vérifie que le stimulus est valide pour éviter les erreurs de calcul
      this.validateStimulus(stimulus);

      // On calcule le temps via la stratégie optimale
      const calculTime = this.timeWithBestStrategy(stimulus);

      this.results.push({
        augend: stimulus.augend,
        addend: stimulus.addend,
        result: stimulus.result,
        temps: calculTime,
        session: stimulus.session,
      });
    });
  }
}
