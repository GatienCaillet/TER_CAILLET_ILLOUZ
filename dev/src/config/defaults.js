export const STORAGE_KEY = "ter-default-params";

export const DEFAULT_PARAMS_INIT = {
  encodingTime: 80,
  comparisonTime: 200,
  commandTime: 300,
  errorRate: 5,
};

export const DEFAULT_PARAMS_ESTIM = {
  alpha: 20,
  beta: 1260,
  delta: 340,
  eta: 270,
  tau: 4800,
  rho: 50,
};

export const DEFAULT_RANGES = {
  alpha: { min: 0, max: 60, pas: 20 },
  beta: { min: 1000, max: 2000, pas: 100 },
  delta: { min: 200, max: 1200, pas: 100 },
  eta: { min: 100, max: 500, pas: 50 },
  tau: { min: 3500, max: 6000, pas: 100 },
  rho: { min: 25, max: 200, pas: 25 },
};

export const DEFAULT_MAX_COMBINATIONS = 10000;
export const DEFAULT_MAX_RANDOM_SAMPLES = 5000;
export const DEFAULT_ESTIMATION_MODE = "grid";
