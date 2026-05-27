import { Model } from "../model/Model";

let currentModel = null;

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === "abort") {
    if (currentModel) {
      currentModel.shouldAbort = true;
    }
    return;
  }

  if (type !== "estimate") {
    return;
  }

  const {
    paramsInit,
    paramsEstim,
    stimuli,
    mode,
    maxCombinations,
    maxRandomSamples,
  } = payload;

  try {
    currentModel = new Model(paramsInit, paramsEstim, stimuli);

    const onProgress = (current, total) => {
      self.postMessage({ type: "progress", current, total });
    };

    let result;
    if (mode === "grid") {
      result = await currentModel.estimateBestParamsWithScores(
        stimuli,
        onProgress,
      );
    } else {
      result = await currentModel.estimateParamsRandom(
        stimuli,
        maxRandomSamples,
        onProgress,
        true,
      );
    }

    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Erreur inconnue",
    });
  } finally {
    currentModel = null;
  }
};
