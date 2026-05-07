<script setup>
import { reactive, ref, computed } from "vue";
import AppInput from "./AppInput.vue";
import AppInputMinMax from "./AppInputMinMax.vue";
import BaseButton from "./BaseButton.vue";

// Prop pour recevoir le résultat de l'estimation du parent
const props = defineProps({
  bestEstimatedParams: {
    type: Object,
    default: null,
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

// Les valeurs par défaut des paramètres d'initialisation
const params = ref({
  encodingTime: 80,
  comparisonTime: 200,
  commandTime: 300,
  errorRate: 5,
});

// La configuration des champs pour les inputs  des paramètres d'initialisation (components/AppInput.vue) du formulaire
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

// Les valeurs par défaut des paramètres d'estimation
const paramsEstimation = ref({
  alpha: 20,
  beta: 1260,
  delta: 340,
  eta: 270,
  tau: 4800,
  rho: 50,
});
const previousParamsEstimation = ref(null);

// La configuration des champs pour les inputs des paramètres d'estimation (components/AppInputMinMax.vue) du formulaire
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

// Ref pour afficher les messages d'erreur
const errorMessage = ref("");
const alertMessage = ref("");
const alertMessageModel = ref("");

const hasImportedData = computed(() => props.dataImported.length > 0);

// Validation complète des paramètres d'estimation
const validateEstimationParams = () => {
  if (!hasImportedData.value) {
    errorMessage.value = '';
    alertMessage.value = '';
    alertMessageModel.value = '';
    return false;
  }

  // Vérifier qu'au moins un paramètre est coché
  const enabledParams = configEstimation.filter((item) => item.enabled);
  if (enabledParams.length === 0) {
    alertMessage.value =
      "Veuillez cocher au moins un paramètre pour lancer l'estimation des paramètres";
    alertMessageModel.value =
      "";
    errorMessage.value = ""; // Réinitialiser l'erreur si tout est bon pour ce paramètre
    return false;
  } else {
    alertMessage.value = "";
    alertMessageModel.value =
      "Des paramètres d'estimation sont sélectionnés pour une estimation de paramètres. Veuillez les déselectionner ou lancer l'estimation des paramètres avant de lancer le modèle.";
  }

  // Vérifier chaque paramètre coché
  for (const item of enabledParams) {
    // Vérifier que pas > 0
    if (!Number.isFinite(item.pas) || item.pas <= 0) {
      errorMessage.value = `"${item.label}" : le pas (step) ne peut pas être à 0 ou négatif`;
      return false;
    }

    // Vérifier que min <= max
    if (item.min > item.max) {
      errorMessage.value = `"${item.label}" : min (${item.min}) est supérieur à max (${item.max})`;
      return false;
    }
  }
  errorMessage.value = ""; // Réinitialiser l'erreur si tout est bon pour ce paramètre
  return true;
};

// Computed pour déterminer si le bouton d'estimation est activé
const canLaunchEstimation = computed(() => {
  // Toujours vérifier la validation
  return validateEstimationParams();
});

// Créer un objet avec les valeurs des paramètres d'estimation (ex: { alpha: { value: 20, enabled: true, min: 0, max: 50, pas: 50 }, ... })
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

// Envoi à App.vue l'information que le bouton "Lancer l'estimation des paramètres" ou "Lancer le modèle" ont été cliqué
const emit = defineEmits(["launch-estimation", "launch-model"]);

// Lancer l'estimation avec validation
const emitLaunchEstimation = () => {
  if (!validateEstimationParams()) {
    return;
  }
  alertMessage.value = ""; // Réinitialiser l'alerte
  alertMessageModel.value = ""; // Réinitialiser l'alerte du modèle
  errorMessage.value = ""; // Réinitialiser l'erreur
  emit("launch-estimation", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
  });
};

const emitLaunchModel = () => {
  alertMessageModel.value = ""; // Réinitialiser l'alerte du modèle
  emit("launch-model", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
  });
};

// Permet au parent (App.vue) de remplacer les paramètres d'estimation
// après une estimation
const setParamsEstim = (newParams) => {
  previousParamsEstimation.value = { ...paramsEstimation.value };
  // newParams attendu sous la forme { alpha: 20, beta: 1000, ... }
  Object.entries(newParams || {}).forEach(([key, value]) => {
    if (key in paramsEstimation.value) {
      paramsEstimation.value[key] = Number(value);
    }
    // Mettre à jour aussi la configuration si besoin pour garder l'UI cohérente
    const cfg = configEstimation.find((it) => it.key === key);
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
          <AppInput
            v-for="item in configInitialisation"
            :key="item.id"
            :id="item.id"
            :label="item.label"
            v-model="params[item.key]"
          />
        </div>
      </div>
      <div class="container border border-1 rounded-4 p-3 mb-3">
        <div id="estimation" class="d-flex flex-column mb-4">
          <div class="ms-5 fw-bold">Paramètres d'estimation :</div>
          <div class="d-flex flex-row justify-content-around flex-wrap">
            <AppInputMinMax
              v-for="item in configEstimation"
              :key="item.id"
              :id="item.id"
              :label="item.label"
              :min="item.min"
              :max="item.max"
              :pas="item.pas"
              v-model="paramsEstimation[item.key]"
              v-model:enabled="item.enabled"
              v-model:min="item.min"
              v-model:max="item.max"
              v-model:pas="item.pas"
            />
          </div>
        </div>

        <!-- Affichage de la meilleure configuration estimée -->
        <div v-if="bestEstimatedParams" class="d-flex justify-content-center">
          <div class="alert alert-success text-center w-auto d-inline-block">
            <strong>✓ Estimation finie, les paramètres d'estimation ont été remplacés par les nouveaux :</strong>
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

        <div class="d-flex flex-column align-items-center">
          <!-- Affichage des erreurs -->
          <div v-if="errorMessage" class="alert alert-danger">
            {{ errorMessage }}
          </div>
          <div v-if="!hasImportedData" class="alert alert-danger">
            Aucune donnée importée. Veuillez en importer avant de lancer l'estimation des paramètres ou le modèle.
          </div>
          <!-- Affichage des alertes -->
          <div v-if="alertMessage" class="alert alert-light">
            {{ alertMessage }}
          </div>
          <BaseButton
            variant="btn btn-primary"
            size="lg"
            :disabled="isEstimating || !canLaunchEstimation || !hasImportedData"
            @click.prevent="emitLaunchEstimation"
          >
            Lancer l'estimation des paramètres
          </BaseButton>
        </div>
      </div>
      <div class="d-flex flex-column align-items-center">
        <!-- Affichage des erreurs -->
        <div v-if="alertMessageModel" class="alert alert-light">
          {{ alertMessageModel }}
        </div>
        <div v-if="!hasImportedData" class="alert alert-danger">
          Aucune donnée importée. Veuillez en importer avant de lancer le modèle.
        </div>
        <BaseButton
          variant="btn btn-primary"
          size="lg"
          :disabled="isEstimating || alertMessageModel || !hasImportedData"
          @click.prevent="emitLaunchModel"
        >
          Lancer le modèle
        </BaseButton>
      </div>
    </form>
  </div>
</template>
