import { Model } from "../model/Model";

let activeModel = null;

self.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type === "abort") {
    if (activeModel) activeModel.shouldAbort = true;
    return;
  }

  if (type !== "runModel") {
    return;
  }

  const { paramsInit, paramsEstim, stimuli } = payload || {};

  try {
    activeModel = new Model(paramsInit, paramsEstim, stimuli);
    activeModel.shouldAbort = false;

    // On utilise TA méthode, en lui passant une fonction fléchée pour la progression
    activeModel.calculEveryStimulusTime(stimuli, (current, total) => {
      self.postMessage({ type: "progress", current, total });
    });

    // Une fois terminé, on renvoie les résultats générés par le modèle
    self.postMessage({
      type: "result",
      result: {
        results: activeModel.results,
        practice: activeModel.practice,
        associations: activeModel.associations,
      },
    });

  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Erreur inconnue",
    });
  } finally {
    activeModel = null;
  }
};