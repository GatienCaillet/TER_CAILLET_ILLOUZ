<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import BaseDataTable from "./components/BaseDataTable.vue";
import ParametersForm from "./components/ParametersForm.vue";
import GraphicsResult from "./components/GraphicsResult.vue";
import { useDataImporter } from "./composables/useDataImporter.js";
import { Model } from "./model/Model";

// Définition des colonnes pour le tableau des équations à donner au modèle
const equationCols = [
  { key: "id", label: "#" },
  { key: "augend", label: "Augend" },
  { key: "addend", label: "Addend" },
  { key: "result", label: "Résultat" },
];

// Définition des colonnes pour les données existantes (en reprenant les colonnes des équations + des colonnes supplémentaires)
const dataCols = [
  ...equationCols, // On reprend la structure précédente
  { key: "time", label: "Temps" },
  { key: "session", label: "Session" },
];

// Définition des ref pour les équations et les données
const equations = ref([]);
const data = ref([]);
const dataResults = ref([]);
const bestEstimatedParams = ref(null); // Stocke les meilleurs paramètres estimés pour les transmettre au formulaire
const isEstimating = ref(false); // Flag pour éviter les appels simultanés
const estimationProgress = ref({ current: 0, total: 0 }); // Suivi de la progression de l'estimation
const loadingStartedAt = ref(0);
const MIN_LOADING_DURATION_MS = 700;
const mainScrollRef = ref(null);
const currentSectionIndex = ref(0);
const totalSections = 3;

// Récupération des fonctions depuis le composable (composables/useDataImporter.js)
const { importEquations, importData } = useDataImporter();

// Handlers qui appellent la logique du composable
const handleImportEquations = () => importEquations(equations);
const handleImportData = () => importData(data);

const buildStimuli = () =>
  data.value.map((equation) => ({
    augend: String(equation.augend ?? "").trim(),
    addend: Number(equation.addend),
    result: String(equation.result ?? "").trim(),
    session: Number(equation.session ?? 1),
  }));

// Référence au composant formulaire pour pouvoir lui demander de mettre à jour les valeurs affichées
const paramsForm = ref(null);

const clampSectionIndex = (index) => Math.min(totalSections - 1, Math.max(0, index));

const updateCurrentSectionIndex = () => {
  const container = mainScrollRef.value;

  if (!container) {
    return;
  }

  const sections = Array.from(container.querySelectorAll(".snap-section"));
  if (!sections.length) {
    return;
  }

  const targetTop = container.scrollTop + container.clientHeight * 0.5;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section, index) => {
    const sectionOffset = section.offsetTop;
    const distance = Math.abs(sectionOffset - targetTop);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  currentSectionIndex.value = clampSectionIndex(bestIndex);
};

const goToSection = async (index) => {
  const container = mainScrollRef.value;
  const targetIndex = clampSectionIndex(index);
  const targetSection = container?.querySelectorAll(".snap-section")?.[targetIndex];

  if (!container || !targetSection) {
    return;
  }

  container.scrollTo({
    top: targetSection.offsetTop,
    behavior: "smooth",
  });
};

const canGoUp = computed(() => currentSectionIndex.value > 0);
const canGoDown = computed(() => currentSectionIndex.value < totalSections - 1);

// Logique pour lancer l'estimation des paramètres
const handleLaunchEstimation = async ({ paramsInit, paramsEstim }) => {
  if (!data.value.length) {
    console.warn(
      "Aucun stimulus importé. Importez des équations avant de lancer l estimation des paramètres.",
    );
    dataResults.value = [];
    return;
  }

  // Empêcher les appels simultanés: verrouiller immédiatement pour éviter une double popup confirm
  if (isEstimating.value) {
    return;
  }
  isEstimating.value = true;

  try {
    const stimuli = buildStimuli();
    const model = new Model(paramsInit, paramsEstim, stimuli);

    // Avertir si trop de combinaisons
    const combCount = model.countGridSearchCombinations();
    const MAX_COMBINATIONS = 10000;
    if (combCount > MAX_COMBINATIONS) {
      const confirmed = window.confirm(
        `Attention : ${combCount} combinaisons à évaluer. Cela peut prendre du temps. Continuer ?`,
      );
      if (!confirmed) {
        isEstimating.value = false;
        return;
      }
    }

    // Initialiser la progression
    estimationProgress.value = { current: 0, total: combCount };
    loadingStartedAt.value = performance.now();

    // Laisser Vue rendre l'indicateur avant de lancer le calcul bloquant
    await nextTick();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Créer une callback de progression pour le modèle
    const onProgress = (current, total) => {
      estimationProgress.value = {
        current,
        total: total ?? combCount,
      };
    };

    // On transmet les données brutes, car l'estimation compare les temps observés
    const bestParams = await model.estimateBestParams(data.value, onProgress);

    // Met à jour le formulaire si possible avec les nouvelles valeurs estimées
    if (
      paramsForm.value &&
      typeof paramsForm.value.setParamsEstim === "function"
    ) {
      paramsForm.value.setParamsEstim(bestParams);
    }

    // Stocke le résultat pour affichage dans l'interface
    bestEstimatedParams.value = bestParams;
  } catch (error) {
    console.error("Impossible de lancer l estimation des paramètres:", error);
  } finally {
    const elapsed = performance.now() - loadingStartedAt.value;
    if (elapsed < MIN_LOADING_DURATION_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING_DURATION_MS - elapsed),
      );
    }
    isEstimating.value = false;
    estimationProgress.value = { current: 0, total: 0 };
    loadingStartedAt.value = 0;
  }
};

// Logique pour lancer le modèle : le Model lit directement les descriptors ou les valeurs simples
const handleLaunchModel = ({ paramsInit, paramsEstim }) => {
  if (!data.value.length) {
    console.warn(
      "Aucun stimulus importé. Importez des équations avant de lancer le modèle.",
    );
    dataResults.value = [];
    return;
  }

  try {
    // Mapping des lignes du tableau vers le format attendu par Model.js
    const stimuli = buildStimuli();

    const model = new Model(paramsInit, paramsEstim, stimuli);

    model.calculEveryStimulusTime(stimuli);

    // Mapping inverse pour afficher les résultats dans la table de l'UI
    dataResults.value = model.results.map((result, index) => ({
      id: index + 1,
      augend: result.augend,
      addend: result.addend,
      result: result.result,
      time: Math.round(result.temps),
      session: result.session,
    }));
  } catch (error) {
    console.error("Impossible de lancer le modèle:", error);
    dataResults.value = [];
  }
};

// Logique pour sauvegarder les résultats (à implémenter)
const handleSaveResults = () => {
  console.log("Btn sauvegarder résultats clicked");
};

onMounted(() => {
  updateCurrentSectionIndex();
  mainScrollRef.value?.addEventListener("scroll", updateCurrentSectionIndex, {
    passive: true,
  });
  window.addEventListener("resize", updateCurrentSectionIndex, { passive: true });
});

onBeforeUnmount(() => {
  mainScrollRef.value?.removeEventListener("scroll", updateCurrentSectionIndex);
  window.removeEventListener("resize", updateCurrentSectionIndex);
});
</script>

<style scoped>
.y-mandatory-scroll-snapping {
  scroll-snap-type: y mandatory;
  overflow-y: auto;
  height: 100vh;
  scroll-behavior: smooth;
}

.scroll-nav {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.scroll-nav button {
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
}

.scroll-nav button:disabled {
  opacity: 0.35;
}

.snap-section {
  min-height: 100vh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  padding: 2rem 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.snap-section-inner {
  width: 100%;
}

.section-title {
  margin-bottom: 1.5rem;
}

.section-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 1.25rem;
  padding: 1.25rem;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
}

.results-section {
  justify-content: flex-start;
  padding-top: 3rem;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(4px);
}

.loading-panel {
  min-height: 160px;
  min-width: 280px;
  padding: 1.5rem 2rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

.loading-spinner {
  width: 72px;
  height: 72px;
  border: 8px solid rgba(13, 110, 253, 0.16);
  border-top-color: #0d6efd;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<template>
  <main ref="mainScrollRef" class="y-mandatory-scroll-snapping">
    <div class="scroll-nav me-3" aria-label="Navigation du scroll">
      <button
        v-if="canGoUp"
        type="button"
        class="btn btn-primary"
        aria-label="Aller à la page précédente"
        @click="goToSection(currentSectionIndex - 1)"
      >
        ↑
      </button>
      <button
        v-if="canGoDown"
        type="button"
        class="btn btn-primary"
        aria-label="Aller à la page suivante"
        @click="goToSection(currentSectionIndex + 1)"
      >
        ↓
      </button>
    </div>
    <section class="snap-section">
      <div class="snap-section-inner container-lg">
        <h1 class="text-center section-title">
          Modélisation de l'apprentissage arithmétique
        </h1>
        <div class="section-card">
          <div class="d-flex flex-column flex-lg-row justify-content-around">
            <BaseDataTable
              title="Aperçu des équations"
              buttonLabel="Importer les équations"
              :rows="equations"
              :columns="equationCols"
              @import="handleImportEquations"
            />

            <BaseDataTable
              title="Aperçu de vos données"
              buttonLabel="Importer les données existantes"
              :rows="data"
              :columns="dataCols"
              @import="handleImportData"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="snap-section">
      <div class="snap-section-inner container-lg">
        <div class="section-card">
          <!-- Formulaire des paramètres d'initialisation et d'estimation -->
          <ParametersForm
            ref="paramsForm"
            :best-estimated-params="bestEstimatedParams"
            :is-estimating="isEstimating"
            :data-imported="data"
            @launch-estimation="handleLaunchEstimation"
            @launch-model="handleLaunchModel"
          />

          <!-- Barre de progression lors de l'estimation -->
          <div
            v-if="isEstimating"
            class="loading-overlay"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="loading-panel d-flex flex-column align-items-center justify-content-center gap-3"
            >
              <div
                class="loading-spinner"
                role="status"
                aria-label="Estimation en cours"
              ></div>
              <p class="text-center mb-0 small text-muted">
                <span v-if="estimationProgress.total > 0">
                  {{ estimationProgress.current }} /
                  {{ estimationProgress.total }} combinaisons traitées
                </span>
                <span v-else> Estimation en cours... </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="snap-section results-section">
      <div class="snap-section-inner container-lg">
        <div class="section-card">
          <BaseDataTable
            title="Tableau des résultats"
            buttonLabel="Sauvegarder les résultats"
            :rows="dataResults"
            :columns="dataCols"
            @import="handleSaveResults"
          />

          <!-- Graphique des résultats -->
          <GraphicsResult :data="dataResults" title="Graphique des résultats" />
        </div>
      </div>
    </section>
  </main>
</template>
