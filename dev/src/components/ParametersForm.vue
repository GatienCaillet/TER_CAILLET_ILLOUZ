<script setup>
import { computed, reactive, ref } from "vue";
import ParameterField from "./ParameterField.vue";
import BaseButton from "./BaseButton.vue";
import BaseDataTable from "./BaseDataTable.vue";

// Formulaire qui regroupe les différents paramètres et les actions de lancement de l'estimation et du modèle 
const props = defineProps({
  bestEstimatedParams: {
    type: Object,
    default: null,
  },
  estimationResultsRows: {
    type: Array,
    default: () => [],
  },
  isEstimating: {
    type: Boolean,
    default: false,
  },
  dataImported: {
    type: Array,
    default: () => [],
  },
});

const STORAGE_KEY = "ter-default-params";

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

const DEFAULT_RANGES = {
  alpha: { min: 0, max: 60, pas: 20 },
  beta: { min: 1000, max: 2000, pas: 100 },
  delta: { min: 200, max: 1200, pas: 100 },
  eta: { min: 100, max: 500, pas: 50 },
  tau: { min: 3500, max: 6000, pas: 100 },
  rho: { min: 0, max: 200, pas: 25 },
};

const DEFAULT_MAX_COMBINATIONS = 10000;

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const cloneRanges = (ranges) =>
  Object.fromEntries(
    Object.entries(ranges).map(([key, range]) => [key, { ...range }]),
  );

const loadDefaults = () => {
  const defaults = {
    paramsInit: { ...DEFAULT_PARAMS_INIT },
    paramsEstim: { ...DEFAULT_PARAMS_ESTIM },
    ranges: cloneRanges(DEFAULT_RANGES),
    maxCombinations: DEFAULT_MAX_COMBINATIONS,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    Object.keys(defaults.paramsInit).forEach((key) => {
      if (key in (parsed?.paramsInit || {})) {
        defaults.paramsInit[key] = toNumber(
          parsed.paramsInit[key],
          defaults.paramsInit[key],
        );
      }
    });

    Object.keys(defaults.paramsEstim).forEach((key) => {
      if (key in (parsed?.paramsEstim || {})) {
        defaults.paramsEstim[key] = toNumber(
          parsed.paramsEstim[key],
          defaults.paramsEstim[key],
        );
      }
    });

    Object.keys(defaults.ranges).forEach((key) => {
      const range = parsed?.ranges?.[key] || {};
      defaults.ranges[key] = {
        min: toNumber(range.min, defaults.ranges[key].min),
        max: toNumber(range.max, defaults.ranges[key].max),
        pas: toNumber(range.pas, defaults.ranges[key].pas),
      };
    });

    if (parsed?.maxCombinations !== undefined) {
      defaults.maxCombinations = toNumber(
        parsed.maxCombinations,
        defaults.maxCombinations,
      );
    }
  } catch (error) {
    console.warn("Impossible de lire les paramètres sauvegardés:", error);
  }

  return defaults;
};

const savedDefaults = loadDefaults();

// Paramètres d'initialisation affichés dans la première partie du formulaire
const params = ref({ ...savedDefaults.paramsInit });

const configInitialisation = [
  { id: "encoding-time", label: "Temps d'encodage (ms)", key: "encodingTime" },
  {
    id: "comparaison-time",
    label: "Temps de comparaison (ms)",
    key: "comparisonTime",
  },
  {
    id: "command-time",
    label: "Temps commande moteur (ms)",
    key: "commandTime",
  },
  { id: "error-rate", label: "Taux d'erreur (%)", key: "errorRate" },
];

// Paramètres d'estimation affichés dans la deuxième partie du formulaire
const paramsEstimation = ref({ ...savedDefaults.paramsEstim });
const previousParamsEstimation = ref(null);
const maxCombinations = ref(savedDefaults.maxCombinations);

// Chaque entrée définit un paramètre d'estimation et sa plage possible
const configEstimation = reactive([
  {
    id: "alpha",
    label: "α : Temps de calcul entre chaque lettre (ms)",
    key: "alpha",
    min: savedDefaults.ranges.alpha.min,
    max: savedDefaults.ranges.alpha.max,
    pas: savedDefaults.ranges.alpha.pas,
    enabled: false,
  },
  {
    id: "beta",
    label: "β : Facteur de durée de comptage",
    key: "beta",
    min: savedDefaults.ranges.beta.min,
    max: savedDefaults.ranges.beta.max,
    pas: savedDefaults.ranges.beta.pas,
    enabled: false,
  },
  {
    id: "delta",
    label:
      "δ : Taux de la diminution de la durée de réponse selon l'entrainement",
    key: "delta",
    min: savedDefaults.ranges.delta.min,
    max: savedDefaults.ranges.delta.max,
    pas: savedDefaults.ranges.delta.pas,
    enabled: false,
  },
  {
    id: "eta",
    label: "η : Temps de récupération en mémoire (ms)",
    key: "eta",
    min: savedDefaults.ranges.eta.min,
    max: savedDefaults.ranges.eta.max,
    pas: savedDefaults.ranges.eta.pas,
    enabled: false,
  },
  {
    id: "tau",
    label: "τ : Facteur de récupération en mémoire",
    key: "tau",
    min: savedDefaults.ranges.tau.min,
    max: savedDefaults.ranges.tau.max,
    pas: savedDefaults.ranges.tau.pas,
    enabled: false,
  },
  {
    id: "rho",
    label:
      "ρ : Taux de la diminution du temps de récupération selon la force de l'association",
    key: "rho",
    min: savedDefaults.ranges.rho.min,
    max: savedDefaults.ranges.rho.max,
    pas: savedDefaults.ranges.rho.pas,
    enabled: false,
  },
]);

const estimationResultCols = [
  { key: "alpha", label: "α" },
  { key: "beta", label: "β" },
  { key: "delta", label: "δ" },
  { key: "eta", label: "η" },
  { key: "tau", label: "τ" },
  { key: "rho", label: "ρ" },
  { key: "rmse", label: "RMSE" },
];

// Messages visibles par l'utilisateur
const errorMessage = ref("");
const alertMessage = ref("");
const alertMessageModel = ref("");

const hasImportedData = computed(() => props.dataImported.length > 0);

// Met en évidence les valeurs extrêmes dans les résultats 
const estimationResultsDisplayRows = computed(() => {
  const rows = props.estimationResultsRows || [];

  if (!rows.length) {
    return [];
  }

  const EPS = 1e-9;
  const bestRow = rows.reduce((best, row) => {
    const currentRmse = Number(row.rmse);

    if (!Number.isFinite(currentRmse)) {
      return best;
    }

    if (!best) {
      return row;
    }

    const bestRmse = Number(best.rmse);
    if (!Number.isFinite(bestRmse)) {
      return row;
    }

    return currentRmse < bestRmse ? row : best;
  }, null);

  if (!bestRow) {
    return rows;
  }

  const configByKey = Object.fromEntries(
    configEstimation.map((item) => [item.key, item]),
  );

  return rows.map((row) => {
    if (row !== bestRow) {
      return row;
    }

    const tagged = { ...row, __cellClasses: { ...(row.__cellClasses || {}) } };

    Object.entries(configByKey).forEach(([key, cfg]) => {
      if (!(key in tagged)) {
        return;
      }

      const value = Number(tagged[key]);
      if (!Number.isFinite(value)) {
        return;
      }

      const isMin = Math.abs(value - Number(cfg.min)) <= EPS;
      const isMax = Math.abs(value - Number(cfg.max)) <= EPS;

      if (isMin && isMax) {
        tagged[key] = `${value} (min/max)`;
        tagged.__cellClasses[key] = "text-danger";
      } else if (isMin) {
        tagged[key] = `${value} (min)`;
        tagged.__cellClasses[key] = "text-danger";
      } else if (isMax) {
        tagged[key] = `${value} (max)`;
        tagged.__cellClasses[key] = "text-danger";
      }
    });

    return tagged;
  });
});

// Vérifie que le formulaire est cohérent avant de lancer l'estimation
const validateEstimationParams = () => {
  if (!hasImportedData.value) {
    errorMessage.value = "";
    alertMessage.value = "";
    alertMessageModel.value = "";
    return false;
  }

  const enabledParams = configEstimation.filter((item) => item.enabled);

  if (enabledParams.length === 0) {
    alertMessage.value =
      "Veuillez cocher au moins un paramètre pour lancer l'estimation des paramètres";
    alertMessageModel.value = "";
    errorMessage.value = "";
    return false;
  }

  alertMessage.value = "";
  alertMessageModel.value =
    "Des paramètres d'estimation sont sélectionnés pour une estimation de paramètres. Veuillez les déselectionner ou lancer l'estimation des paramètres avant de lancer le modèle.";

  for (const item of enabledParams) {
    if (!Number.isFinite(item.pas) || item.pas <= 0) {
      errorMessage.value = `"${item.label}" : le pas (step) ne peut pas être à 0 ou négatif`;
      return false;
    }

    if (item.min > item.max) {
      errorMessage.value = `"${item.label}" : min (${item.min}) est supérieur à max (${item.max})`;
      return false;
    }

    if (item.key === "rho") {
      const rhoValue = Number(paramsEstimation.value[item.key]);
      if (
        !Number.isFinite(rhoValue) ||
        rhoValue <= 0 ||
        item.min <= 0 ||
        item.max <= 0
      ) {
        errorMessage.value =
          `"${item.label}" : ρ doit être strictement positif (valeur, min et max)`;
        return false;
      }
    }
  }

  errorMessage.value = "";
  return true;
};

// Validation calculée à la demande pour garder l'interface réactive
const canLaunchEstimation = computed(() => validateEstimationParams());

const rhoModelError = computed(() => {
  const rhoValue = Number(paramsEstimation.value.rho);
  if (!Number.isFinite(rhoValue) || rhoValue <= 0) {
    return "La valeur de ρ : Taux de la diminution du temps de récupération selon la force de l'association doit être strictement positive.";
  }
  return "";
});

// Transforme la configuration en objet directement exploitable par App.vue
const buildParamsEstimPayload = () =>
  Object.fromEntries(
    configEstimation.map((item) => [
      item.key,
      {
        value: paramsEstimation.value[item.key],
        enabled: item.enabled,
        min: item.min,
        max: item.max,
        pas: item.pas,
      },
    ]),
  );

const emit = defineEmits(["launch-estimation", "launch-model"]);

const isSettingsOpen = ref(false);
const settingsDraft = ref({
  paramsInit: { ...savedDefaults.paramsInit },
  paramsEstim: { ...savedDefaults.paramsEstim },
  ranges: cloneRanges(savedDefaults.ranges),
  maxCombinations: savedDefaults.maxCombinations,
});

const buildDefaultsSnapshot = () => ({
  paramsInit: { ...params.value },
  paramsEstim: { ...paramsEstimation.value },
  ranges: Object.fromEntries(
    configEstimation.map((item) => [item.key, {
      min: item.min,
      max: item.max,
      pas: item.pas,
    }]),
  ),
  maxCombinations: maxCombinations.value,
});

const openSettings = () => {
  settingsDraft.value = buildDefaultsSnapshot();
  isSettingsOpen.value = true;
};

const closeSettings = () => {
  isSettingsOpen.value = false;
};

const persistDefaults = (payload) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible de sauvegarder les paramètres:", error);
  }
};

const applyDefaults = (payload) => {
  Object.keys(DEFAULT_PARAMS_INIT).forEach((key) => {
    params.value[key] = toNumber(payload.paramsInit[key], DEFAULT_PARAMS_INIT[key]);
  });

  Object.keys(DEFAULT_PARAMS_ESTIM).forEach((key) => {
    paramsEstimation.value[key] = toNumber(
      payload.paramsEstim[key],
      DEFAULT_PARAMS_ESTIM[key],
    );
  });

  configEstimation.forEach((item) => {
    const range = payload.ranges?.[item.key] || {};
    item.min = toNumber(range.min, DEFAULT_RANGES[item.key].min);
    item.max = toNumber(range.max, DEFAULT_RANGES[item.key].max);
    item.pas = toNumber(range.pas, DEFAULT_RANGES[item.key].pas);
  });

  maxCombinations.value = toNumber(
    payload.maxCombinations,
    DEFAULT_MAX_COMBINATIONS,
  );
};

const saveSettings = () => {
  const payload = {
    paramsInit: { ...settingsDraft.value.paramsInit },
    paramsEstim: { ...settingsDraft.value.paramsEstim },
    ranges: { ...settingsDraft.value.ranges },
    maxCombinations: settingsDraft.value.maxCombinations,
  };

  applyDefaults(payload);
  persistDefaults(payload);
  closeSettings();
};

const resetSettings = () => {
  const payload = {
    paramsInit: { ...DEFAULT_PARAMS_INIT },
    paramsEstim: { ...DEFAULT_PARAMS_ESTIM },
    ranges: cloneRanges(DEFAULT_RANGES),
    maxCombinations: DEFAULT_MAX_COMBINATIONS,
  };

  settingsDraft.value = {
    paramsInit: { ...payload.paramsInit },
    paramsEstim: { ...payload.paramsEstim },
    ranges: cloneRanges(payload.ranges),
    maxCombinations: payload.maxCombinations,
  };
  applyDefaults(payload);
  persistDefaults(payload);
};

// Déclenche une estimation avec les paramètres d'estimation sélectionnés et les paramètres d'initialisation
const emitLaunchEstimation = () => {
  if (!validateEstimationParams()) {
    return;
  }

  alertMessage.value = "";
  alertMessageModel.value = "";
  errorMessage.value = "";

  emit("launch-estimation", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
    maxCombinations: maxCombinations.value,
  });
};

// Déclenche le modèle avec tous les paramètres d'estimation et d'initialisation, même ceux non sélectionnés
const emitLaunchModel = () => {  
  alertMessageModel.value = "";

  emit("launch-model", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
    maxCombinations: maxCombinations.value,
  });
};

// Permet à App.vue de remplacer les paramètres après une estimation réussie
const setParamsEstim = (newParams) => {
  previousParamsEstimation.value = { ...paramsEstimation.value };

  Object.entries(newParams || {}).forEach(([key, value]) => {
    if (key in paramsEstimation.value) {
      paramsEstimation.value[key] = Number(value);
    }

    const cfg = configEstimation.find((item) => item.key === key);
    if (cfg) {
      cfg.min = cfg.min ?? cfg.min;
      cfg.max = cfg.max ?? cfg.max;
    }
  });
};

defineExpose({ setParamsEstim });
</script>

<template>
  <div class="container">
    <form>
      <div id="initialisation" class="d-flex flex-column">
        <div class="d-flex align-items-center justify-content-between ms-5 me-3">
          <div class="fw-bold">Paramètres d'initialisation :</div>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            aria-label="Ouvrir les paramètres par défaut"
            @click="openSettings"
          >
            <i class="bi bi-gear" aria-hidden="true"></i>
            Par défaut
          </button>
        </div>
        <div class="d-flex flex-row justify-content-around flex-wrap">
          <ParameterField
            v-for="item in configInitialisation"
            :key="item.id"
            :id="item.id"
            v-model="params[item.key]"
            :label="item.label"
          />
        </div>
      </div>

      <div class="container border rounded-4 p-3 mb-3">
        <div id="estimation" class="d-flex flex-column mb-4">
          <div class="ms-5 fw-bold">Paramètres d'estimation :</div>

          <div class="gap-2 d-flex ms-5 mt-2">
            <BaseButton
              size="md"
              variant="btn btn-primary"
              @click.prevent="configEstimation.forEach((item) => item.enabled = true)"
            >
              Tout sélectionner
            </BaseButton>

            <BaseButton
              variant="btn btn-outline-primary"
              @click.prevent="configEstimation.forEach((item) => item.enabled = false)"
            >
              Tout désélectionner
            </BaseButton>
          </div>

          <div class="d-flex flex-row justify-content-around flex-wrap">
            <ParameterField
              v-for="item in configEstimation"
              :key="item.id"
              v-model="paramsEstimation[item.key]"
              v-model:enabled="item.enabled"
              v-model:max="item.max"
              v-model:min="item.min"
              v-model:pas="item.pas"
              :id="item.id"
              :label="item.label"
              :show-range="true"
            />
          </div>
        </div>

        <div v-if="bestEstimatedParams" class="d-flex justify-content-center">
          <div class="alert alert-success text-center w-auto d-inline-block">
            <strong>
              ✓ Estimation finie, les paramètres d'estimation ont été remplacés par les nouveaux :
            </strong>

            <div class="mt-2">
              <div
                v-for="(value, key) in bestEstimatedParams"
                :key="key"
                class="small"
              >
                <strong>{{ key }} :</strong>
                {{ Number(previousParamsEstimation?.[key] ?? 0) }}
                → {{ Number(value) }}
              </div>
            </div>
          </div>
        </div>

        <BaseDataTable
          :columns="estimationResultCols"
          :hide-button-when-empty="true"
          :rows="estimationResultsDisplayRows"
          :sortable="true"
          buttonLabel="Exporter les résultats de l'estimation"
          initial-sort-direction="asc"
          initial-sort-key="rmse"
          title="RMSE de chaque combinaison des paramètres d'estimation"
        />

        <div class="d-flex flex-column align-items-center">
          <div v-if="errorMessage" class="alert alert-danger">
            {{ errorMessage }}
          </div>

          <div v-if="!hasImportedData" class="alert alert-danger">
            Aucune donnée importée. Veuillez en importer avant de lancer l'estimation des paramètres ou le modèle.
          </div>

          <div v-if="alertMessage" class="alert alert-light">
            {{ alertMessage }}
          </div>

          <BaseButton
            class="mt-3"
            size="lg"
            variant="btn btn-primary"
            :disabled="isEstimating || !canLaunchEstimation || !hasImportedData"
            @click.prevent="emitLaunchEstimation"
          >
            Lancer l'estimation des paramètres
          </BaseButton>
        </div>
      </div>

      <div class="d-flex flex-column align-items-center">
        <div v-if="rhoModelError" class="alert alert-danger">
          {{ rhoModelError }}
        </div>

        <div v-if="alertMessageModel" class="alert alert-light">
          {{ alertMessageModel }}
        </div>

        <div v-if="!hasImportedData" class="alert alert-danger">
          Aucune donnée importée. Veuillez en importer avant de lancer le modèle.
        </div>

        <BaseButton
          size="lg"
          variant="btn btn-primary"
          :disabled="isEstimating || rhoModelError || alertMessageModel || !hasImportedData"
          @click.prevent="emitLaunchModel"
        >
          Lancer le modèle
        </BaseButton>
      </div>
    </form>

    <div
      v-if="isSettingsOpen"
      class="settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Paramètres par défaut"
      @click.self="closeSettings"
    >
      <div class="settings-modal">
        <div class="settings-modal-header d-flex align-items-center justify-content-between mb-3">
          <h5 class="mb-0">Paramètres par défaut</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Fermer"
            @click="closeSettings"
          ></button>
        </div>

        <div class="grow overflow-auto pt-3 px-4 pb-4">
          <div class="settings-section">
            <div class="fw-bold mb-2">Initialisation</div>
            <div class="row g-3">
              <div
                v-for="item in configInitialisation"
                :key="`default-${item.id}`"
                class="col-6"
              >
                <label :for="`default-${item.id}`" class="form-label small">
                  {{ item.label }}
                </label>
                <input
                  :id="`default-${item.id}`"
                  v-model.number="settingsDraft.paramsInit[item.key]"
                  class="form-control"
                  type="number"
                />
              </div>
            </div>
          </div>

          <div class="settings-section mt-4">
            <div class="fw-bold mb-2">Estimation</div>
            <div class="row g-3">
              <div
                v-for="item in configEstimation"
                :key="`default-${item.id}-estim`"
                class="col-12"
              >
                <div class="border rounded-3 p-3">
                  <div class="fw-semibold small">{{ item.label }}</div>
                  <div class="row g-2 mt-1">
                    <div class="col-6 col-lg-3">
                      <label class="form-label small">Valeur</label>
                      <input
                        v-model.number="settingsDraft.paramsEstim[item.key]"
                        class="form-control form-control-sm"
                        type="number"
                      />
                    </div>
                    <div class="col-6 col-lg-3">
                      <label class="form-label small">Min</label>
                      <input
                        v-model.number="settingsDraft.ranges[item.key].min"
                        class="form-control form-control-sm"
                        type="number"
                      />
                    </div>
                    <div class="col-6 col-lg-3">
                      <label class="form-label small">Max</label>
                      <input
                        v-model.number="settingsDraft.ranges[item.key].max"
                        class="form-control form-control-sm"
                        type="number"
                      />
                    </div>
                    <div class="col-6 col-lg-3">
                      <label class="form-label small">Pas</label>
                      <input
                        v-model.number="settingsDraft.ranges[item.key].pas"
                        class="form-control form-control-sm"
                        type="number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section mt-4">
            <div class="fw-bold mb-2">Sécurité du calcul</div>
            <div class="row g-3">
              <div class="col-12 col-lg-6">
                <label for="default-max-combinations" class="form-label small">
                  Nombre maximum de combinaisons évaluées
                </label>
                <input
                  id="default-max-combinations"
                  v-model.number="settingsDraft.maxCombinations"
                  class="form-control"
                  type="number"
                  min="1"
                />
                <div class="form-text">
                  Limite de sécurité pour éviter un calcul trop long. Si le nombre
                  de combinaisons à tester dépasse cette valeur, un message de
                  confirmation s'affiche avant de lancer l'estimation.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-modal-footer d-flex flex-wrap justify-content-end gap-2 mt-4">
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="resetSettings"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            class="btn btn-outline-primary"
            @click="closeSettings"
          >
            Annuler
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="saveSettings"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.settings-modal {
  width: min(960px, 100%);
  max-height: 90vh;
  background: #fff;
  border-radius: 1rem;
  padding: 0;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-modal-header,
.settings-modal-footer {
  background: #fff;
  flex: 0 0 auto;
  padding: 1.5rem;
}

.settings-modal-header {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.settings-modal-footer {
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}
</style>
