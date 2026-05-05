<script setup>
import { reactive, ref, computed } from "vue";
import AppInput from "./AppInput.vue";
import AppInputMinMax from "./AppInputMinMax.vue";
import BaseButton from "./BaseButton.vue";

// Prop pour recevoir le résultat de l'estimation du parent
defineProps({
  bestEstimatedParams: {
    type: Object,
    default: null,
  },
  isEstimating: {
    type: Boolean,
    default: false,
  },
});

// Les valeurs par défaut des paramètres d'initialisation
const params = ref({
  encodingTime: 80,
  comparisonTime: 200,
  commandTime: 300,
  errorRate: 5
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

// La configuration des champs pour les inputs des paramètres d'estimation (components/AppInputMinMax.vue) du formulaire
const configEstimation = reactive([
  {
    id: "alpha",
    label: "α : Temps de calcul entre chaque lettre (ms)",
    key: "alpha",
    min: 0,
    max: 50,
    pas: 50,
    enabled: false,
  },
  {
    id: "beta",
    label: "β : Facteur de durée de comptage",
    key: "beta",
    min: 0,
    max: 50,
    pas: 50,
    enabled: false,
  },
  {
    id: "delta",
    label: "δ : Taux de la diminution de la durée de réponse selon l'entrainement",
    key: "delta",
    min: 200,
    max: 1200,
    pas: 50,
    enabled: false,
  },
  {
    id: "eta",
    label: "η : Temps de récupération en mémoire (ms)",
    key: "eta",
    min: 100,
    max: 250,
    pas: 50,
    enabled: false,
  },
  {
    id: "tau",
    label: "τ : Facteur de récupération en mémoire",
    key: "tau",
    min: 3500,
    max: 5000,
    pas: 50,
    enabled: false,
  },
  {
    id: "rho",
    label: "ρ : Taux de la diminution du temps de récupération selon la force de l'association",
    key: "rho",
    min: 50,
    max: 100,
    pas: 25,
    enabled: false,
  },
]);

// Ref pour afficher les messages d'erreur
const errorMessage = ref('');

// Validation complète des paramètres d'estimation
const validateEstimationParams = () => {
  // Vérifier qu'au moins un paramètre est coché
  const enabledParams = configEstimation.filter((item) => item.enabled);
  if (enabledParams.length === 0) {
    errorMessage.value = 'Veuillez cocher au moins un paramètre pour lancer l\'estimation des paramètres';
    return false;
  } 
  else {
    errorMessage.value = 'Veuillez lancer l\'estimation des paramètres avant de lancer le modèle'; 
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
  
  errorMessage.value = ''; // Réinitialiser l'erreur
  emit("launch-estimation", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
  });
};

const emitLaunchModel = () => {
  emit("launch-model", {
    paramsInit: { ...params.value },
    paramsEstim: buildParamsEstimPayload(),
  });
};

// Permet au parent (App.vue) de remplacer les paramètres d'estimation
// après une estimation
const setParamsEstim = (newParams) => {
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
  <div class="container mt-4">
    <form>
      <div id="initialization" class="d-flex flex-column mb-4">
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
      <!-- Affichage des erreurs -->
      <div v-if="errorMessage" class="alert alert-danger mt-3 w-75">
        {{ errorMessage }}
      </div>
      
      <div class="d-flex flex-column align-items-center gap-3">
        <BaseButton
          variant="btn btn-primary"
          size="lg"
          :disabled="isEstimating || !canLaunchEstimation"
          @click.prevent="emitLaunchEstimation"
        >
          Lancer l'estimation des paramètres
        </BaseButton>
        <BaseButton
          variant="btn btn-primary"
          size="lg"
          :disabled="isEstimating || canLaunchEstimation"
          @click.prevent="emitLaunchModel"
        >
          Lancer le modèle
        </BaseButton>
        
        <!-- Affichage de la meilleure configuration estimée -->
        <div v-if="bestEstimatedParams" class="alert alert-success mt-3 w-75">
          <strong>✓ Estimation complète !</strong>
          <div class="mt-2">
            <div v-for="(value, key) in bestEstimatedParams" :key="key" class="small">
              <strong>{{ key }}:</strong> {{ Number(value) }}
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
