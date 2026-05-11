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

// Paramètres d'initialisation affichés dans la première partie du formulaire
const params = ref({
  encodingTime: 80,
  comparisonTime: 200,
  commandTime: 300,
  errorRate: 5,
});

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
const paramsEstimation = ref({
  alpha: 20,
  beta: 1260,
  delta: 340,
  eta: 270,
  tau: 4800,
  rho: 50,
});
const previousParamsEstimation = ref(null);

// Chaque entrée définit un paramètre d'estimation et sa plage possible
const configEstimation = reactive([
  {
    id: "alpha",
    label: "α : Temps de calcul entre chaque lettre (ms)",
    key: "alpha",
    min: 0,
    max: 60,
    pas: 20,
    enabled: false,
  },
  {
    id: "beta",
    label: "β : Facteur de durée de comptage",
    key: "beta",
    min: 1000,
    max: 2000,
    pas: 100,
    enabled: false,
  },
  {
    id: "delta",
    label:
      "δ : Taux de la diminution de la durée de réponse selon l'entrainement",
    key: "delta",
    min: 200,
    max: 1200,
    pas: 100,
    enabled: false,
  },
  {
    id: "eta",
    label: "η : Temps de récupération en mémoire (ms)",
    key: "eta",
    min: 100,
    max: 500,
    pas: 50,
    enabled: false,
  },
  {
    id: "tau",
    label: "τ : Facteur de récupération en mémoire",
    key: "tau",
    min: 3500,
    max: 6000,
    pas: 100,
    enabled: false,
  },
  {
    id: "rho",
    label:
      "ρ : Taux de la diminution du temps de récupération selon la force de l'association",
    key: "rho",
    min: 0,
    max: 200,
    pas: 25,
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
  }

  errorMessage.value = "";
  return true;
};

// Validation calculée à la demande pour garder l'interface réactive
const canLaunchEstimation = computed(() => validateEstimationParams());

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
  });
};

// Déclenche le modèle avec tous les paramètres d'estimation et d'initialisation, même ceux non sélectionnés
const emitLaunchModel = () => {
  alertMessageModel.value = "";

  emit("launch-model", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
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
        <div class="ms-5 fw-bold">Paramètres d'initialisation :</div>
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
        <div v-if="alertMessageModel" class="alert alert-light">
          {{ alertMessageModel }}
        </div>

        <div v-if="!hasImportedData" class="alert alert-danger">
          Aucune donnée importée. Veuillez en importer avant de lancer le modèle.
        </div>

        <BaseButton
          size="lg"
          variant="btn btn-primary"
          :disabled="isEstimating || alertMessageModel || !hasImportedData"
          @click.prevent="emitLaunchModel"
        >
          Lancer le modèle
        </BaseButton>
      </div>
    </form>
  </div>
</template>
