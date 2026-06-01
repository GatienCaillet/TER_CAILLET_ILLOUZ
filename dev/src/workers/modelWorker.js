import { Model } from "../model/Model";

let shouldAbort = false;

self.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type === "abort") {
    shouldAbort = true;
    return;
  }

  if (type !== "runModel") {
    return;
  }

  const { paramsInit, paramsEstim, stimuli } = payload || {};

  try {
    shouldAbort = false;
    const model = new Model(paramsInit, paramsEstim, stimuli);
    model.resetState();

    const results = [];
    const total = Array.isArray(stimuli) ? stimuli.length : 0;
    const progressEvery = Math.max(1, Math.floor(total / 200));
    let lastProgressAt = 0;

    for (let index = 0; index < total; index += 1) {
      if (shouldAbort) {
        throw new Error("Model aborted by user");
      }

      const stimulus = stimuli[index];
      model.validateStimulus(stimulus);

      const { time: calculTime, method } = model.timeWithBestStrategy(stimulus);

      if (calculTime !== null) {
        results.push({
          augend: stimulus.augend,
          addend: stimulus.addend,
          result: stimulus.result,
          time: calculTime,
          method,
          session: stimulus.session,
        });
      }

      const current = index + 1;
      const now = performance.now();
      if (
        current === total ||
        current % progressEvery === 0 ||
        now - lastProgressAt >= 200
      ) {
        lastProgressAt = now;
        self.postMessage({ type: "progress", current, total });
      }
    }

    self.postMessage({
      type: "result",
      result: {
        results,
        practice: model.practice,
        associations: model.associations,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Erreur inconnue",
    });
  } finally {
    shouldAbort = false;
  }
};
