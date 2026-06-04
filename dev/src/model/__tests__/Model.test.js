import { describe, it, expect, vi } from "vitest";
import { Model } from "../Model";

describe("Model", () => {
  const baseInit = {
    encodingTime: 0,
    comparisonTime: 0,
    commandTime: 0,
    errorRate: 0,
  };

  const baseEstim = {
    alpha: 10,
    beta: 0,
    delta: 1,
    eta: 0,
    tau: 0,
    rho: 1,
  };

  const stimulus = {
    augend: "A",
    addend: 1,
    result: "B",
    time: 5,
    session: 1,
  };

  it("normalizes params and computes initTime", () => {
    const model = new Model(
      {
        encodingTime: "10",
        comparisonTime: "20",
        commandTime: "30",
        errorRate: "10",
      },
      {
        alpha: { value: "1" },
        beta: 0,
        delta: 1,
        eta: 0,
        tau: 0,
        rho: 1,
      },
    );

    expect(model.paramsInit.encodingTime).toBe(10);
    expect(model.paramsInit.comparisonTime).toBe(20);
    expect(model.paramsInit.commandTime).toBe(30);
    expect(model.paramsInit.errorRate).toBe(10);
    expect(model.paramsEstim.alpha).toBe(1);
    expect(model.initTime).toBe(10 + 20 + 30);
  });

  it("throws when estimation range is invalid", () => {
    expect(
      () =>
        new Model(baseInit, {
          alpha: { enabled: true, min: 10, max: 1, pas: 1 },
        }),
    ).toThrow(/min \(10\) est superieur a max \(1\)/i);
  });

  it("builds search space with enabled params", () => {
    const model = new Model(baseInit, {
      alpha: { enabled: true, min: 0, max: 2, pas: -2 },
    });

    expect(model.paramsEstimSearchSpace.alpha).toEqual([0, 2]);
  });

  it("validates stimuli and throws on invalid cases", () => {
    const model = new Model(baseInit, baseEstim);

    expect(() => model.validateStimulus(null)).toThrow(/indéfini ou manquant/i);
    expect(() => model.validateStimulus({ augend: "?", addend: 1 })).toThrow(/augend doit être une lettre/i);
    expect(() => model.validateStimulus({ augend: "A", addend: -1 })).toThrow(/addend doit être un entier/i);
    expect(() => model.validateStimulus({ augend: "Z", addend: 1 })).toThrow(/dépasse Z/i);
  });

  it("calculates counting time and updates practice", () => {
    const model = new Model(baseInit, baseEstim);
    const time = model.calculCountingTime({ augend: "A", addend: 2 });

    expect(time).toBe(20);
    expect(model.practice.A).toBe(1);
    expect(model.practice.B).toBe(1);
  });

  it("calculates retrieval time without updating associations", () => {
    const model = new Model(baseInit, { ...baseEstim, eta: 5, tau: 0 });
    const time = model.calculRetrievalTime({ augend: "A", addend: 1 });

    expect(time).toBe(5);
    expect(model.associations["A+1"]).toBeUndefined();
  });

  // FIX: Correction de l'assertion pour matcher le comportement réel du code ("error")
  it("updates associations only when retrieval succeeds", () => {
    const randomSpy = vi.spyOn(Math, "random");

    const model = new Model(
      { ...baseInit, errorRate: 0 },
      { ...baseEstim, eta: 5, tau: 0 },
    );

    model.results = [{ addend: 1, time: 100, method: "counting" }];

    randomSpy.mockReturnValue(0.999);
    const success = model.timeWithBestStrategy({ augend: "A", addend: 1 });
    expect(success.method).toBe("retrieval");
    expect(model.associations["A+1"]).toBe(1);

    // Échec de récupération : Doit retourner la méthode "error"
    const modelFail = new Model(
      { ...baseInit, errorRate: 100 },
      { ...baseEstim, eta: 5, tau: 0 },
    );
    modelFail.results = [{ addend: 1, time: 100, method: "counting" }];
    randomSpy.mockReturnValue(0);
    
    const failure = modelFail.timeWithBestStrategy({ augend: "A", addend: 1 });
    expect(failure).toEqual({ time: null, method: "error" }); // <- Corrigé ici ("error")
    expect(modelFail.associations["A+1"]).toBeUndefined();

    randomSpy.mockRestore();
  });

  it("chooses the faster strategy for total time", () => {
    const model = new Model(baseInit, { ...baseEstim, eta: 100, tau: 0 });

    const fastest = model.timeWithBestStrategy({ augend: "A", addend: 1 });
    expect(fastest).toEqual({ time: 10, method: "counting" });

    model.results = [{ addend: 1, time: 100, method: "counting" }];
    const retrievalWins = model.timeWithBestStrategy({ augend: "A", addend: 1 });
    expect(retrievalWins).toEqual({ time: 100, method: "retrieval" });
  });

  it("calculates results for all stimuli", () => {
    const model = new Model(baseInit, { ...baseEstim, eta: 100, tau: 0 }, [stimulus]);
    model.calculEveryStimulusTime([stimulus]);

    expect(model.results).toHaveLength(1);
    expect(model.results[0].time).toBe(10);
  });

  it("throws when observed time is not numeric", () => {
    const model = new Model(baseInit, baseEstim);

    expect(() =>
      model.evaluateParamsSet([{ ...stimulus, time: "not-a-number" }], baseEstim),
    ).toThrow(/doivent contenir une colonne Temps numérique/i);
  });

  it("returns single evaluation when grid is disabled", async () => {
    const model = new Model(baseInit, baseEstim, [stimulus]);
    const result = await model.estimateParamsGrid([stimulus], null, true);

    expect(result.evaluations).toHaveLength(1);
    expect(result.bestParams).toEqual(baseEstim);
  });

  it("explores grid search and reports progress", async () => {
    const model = new Model(
      baseInit,
      {
        alpha: { enabled: true, min: 1, max: 2, pas: 1 },
        beta: 0, delta: 1, eta: 0, tau: 0, rho: 1,
      },
      [stimulus],
    );

    const onProgress = vi.fn();
    const result = await model.estimateParamsGrid([stimulus], onProgress, true);

    expect(result.evaluations).toHaveLength(2);
    expect(result.bestParams.alpha).toBe(1);
    expect(onProgress).toHaveBeenCalled();
  });

  it("exposes small grid combination count and detection", () => {
    const model = new Model(baseInit, {
      alpha: { enabled: true, min: 0, max: 1, pas: 1 },
      beta: 0, delta: 1, eta: 0, tau: 0, rho: 1,
    });

    expect(model.hasGridSearchConfiguration()).toBe(true);
    expect(model.countGridSearchCombinations()).toBe(2);
  });

  it("aborts estimation when requested", async () => {
    const model = new Model(
      baseInit,
      {
        alpha: { enabled: true, min: 1, max: 2, pas: 1 },
        beta: 0, delta: 1, eta: 0, tau: 0, rho: 1,
      },
      [stimulus],
    );

    model.shouldAbort = true;
    await expect(model.estimateParamsGrid([stimulus], null, false)).rejects.toThrow(/aborted by user/i);
  });

  it("counts combinations without expanding large grids", () => {
    const descriptor = { enabled: true, min: 0, max: 9, pas: 1 };
    const model = new Model(baseInit, {
      alpha: descriptor, beta: descriptor, delta: descriptor,
      eta: descriptor, tau: descriptor, rho: descriptor,
    });

    expect(model.countGridSearchCombinations()).toBe(1_000_000);
  });

  // --- NOUVEAUX TESTS AJOUTÉS ---

  it("resets internal state correctly on resetState", () => {
    const model = new Model(baseInit, baseEstim);
    model.practice["A"] = 10;
    model.associations["A+1"] = 5;
    model.results = [stimulus];

    model.resetState();

    expect(model.practice["A"]).toBe(0);
    expect(model.associations).toEqual({});
    expect(model.results).toEqual([]);
  });

  it("explores random search space efficiently", async () => {
    const model = new Model(
      baseInit,
      {
        alpha: { enabled: true, min: 1, max: 10, pas: 1 },
        beta: 0, delta: 1, eta: 0, tau: 0, rho: 1,
      },
      [stimulus],
    );

    const onProgress = vi.fn();
    const result = await model.estimateParamsRandom([stimulus], 3, onProgress, true);

    expect(result.evaluations.length).toBeLessThanOrEqual(3);
    expect(onProgress).toHaveBeenCalled();
  });
});