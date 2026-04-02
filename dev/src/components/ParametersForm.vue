<script setup>
import { ref } from "vue";
import AppInput from "./AppInput.vue";
import AppInputMinMax from "./AppInputMinMax.vue";
import BaseButton from "./BaseButton.vue";

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
const configEstimation = [
  {
    id: "alpha",
    label: "α : Temps de calcul entre chaque lettre (ms)",
    key: "alpha",
    min: 20,
    max: 50,
    pas: 50,
  },
  {
    id: "beta",
    label: "β : Facteur de durée de comptage",
    key: "beta",
    min: 50,
    max: 50,
    pas: 50,
  },
  {
    id: "delta",
    label: "δ : Diviseur de la durée de comptage",
    key: "delta",
    min: 200,
    max: 1200,
    pas: 50,
  },
  {
    id: "eta",
    label: "η : Temps de récupération en mémoire (ms)",
    key: "eta",
    min: 100,
    max: 250,
    pas: 50,
  },
  {
    id: "tau",
    label: "τ : Facteur de récupération en mémoire",
    key: "tau",
    min: 3500,
    max: 5000,
    pas: 50,
  },
  {
    id: "rho",
    label: "ρ : Diviseur de la récupération en mémoire",
    key: "rho",
    min: 50,
    max: 100,
    pas: 25,
  },
];

// Envoi à App.vue l'information que le bouton "Lancer l'estimation des paramètres" ou "Lancer le modèle" ont été cliqué
const emit = defineEmits(["launch-estimation", "launch-model"]);

const emitLaunchEstimation = () => {
  emit("launch-estimation", {
    paramsInit: { ...params.value },
    paramsEstim: { ...paramsEstimation.value },
  });
};

const emitLaunchModel = () => {
  emit("launch-model", {
    paramsInit: { ...params.value },
    paramsEstim: { ...paramsEstimation.value },
  });
};
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
          />
        </div>
      </div>
      <div class="d-flex flex-column align-items-center gap-3">
        <BaseButton
          variant="btn btn-primary"
          size="lg"
          :disabled="false"
          @click.prevent="emitLaunchEstimation"
        >
          Lancer l'estimation des paramètres (environ X minutes)
        </BaseButton>
        <BaseButton
          variant="btn btn-primary"
          size="lg"
          :disabled="false"
          @click.prevent="emitLaunchModel"
        >
          Lancer le modèle
        </BaseButton>
      </div>
    </form>
  </div>
</template>
