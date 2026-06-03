<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseDataTable from "./components/BaseDataTable.vue";
import GraphicsResult from "./components/GraphicsResult.vue";
import ParametersForm from "./components/ParametersForm.vue";
import { useDataIO } from "./composables/useDataIO.js";
import { Model } from "./model/Model";
import BaseButton from "./components/BaseButton.vue";
import { Alert } from "bootstrap/dist/js/bootstrap.bundle";

// Colonnes communes aux tableaux d'équations et de résultats
const equationCols = [
  { key: "id", label: "#" },
  { key: "augend", label: "Augend" },
  { key: "addend", label: "Addend" },
  { key: "result", label: "Résultat" },
  { key: "session", label: "Session" },
];

// Les données importées reprennent ces colonnes avec deux champs supplémentaires
const dataCols = [
  ...equationCols,
  { key: "time", label: "Temps" },
];

// Colonnes pour les résultats du modèle (inclut la méthode utilisée)
const resultCols = [
  ...equationCols,
  { key: "time", label: "Temps" },
  { key: "method", label: "Méthode" },
];

// État principal de l'application.
const equations = ref([]);
const data = ref([]);
const dataResults = ref([]);
const practiceMap = ref({});
const associationsMap = ref({});
const bestEstimatedParams = ref(null);
const estimationResultsRows = ref([]);
const isEstimating = ref(false);
const isModelRunning = ref(false);
const isGeneratingEquations = ref(false);
const estimationProgress = ref({ current: 0, total: 0 });
const modelProgress = ref({ current: 0, total: 0 });
const loadingStartedAt = ref(0);
const modelLoadingStartedAt = ref(0);
const generationLoadingStartedAt = ref(0);
const currentEstimationModel = ref(null);
const estimationWorker = ref(null);
const modelWorker = ref(null);
const equationWorker = ref(null);
const isImportingEquations = ref(false);
const isImportingData = ref(false);
const MIN_LOADING_DURATION_MS = 700;
const mainScrollRef = ref(null);
const currentSectionIndex = ref(0);
const isEquationOpen = ref(false);

const alphabetWithoutYZ = "ABCDEFGHIJKLMNOPQRSTUVWX";
const defaultAddends = ["2", "3", "4", "5"];
const selectedAugends = ref([]);
const selectedAddends = ref([]);
const customAddends = ref([]);
const numSessions = ref(1);
const numRep = ref(1);
const showAddendInput = ref(false);
const customAddendValue = ref("");

const allAvailableAddends = computed(() =>
  [...defaultAddends, ...customAddends.value].sort((a, b) => parseInt(a) - parseInt(b))
);

const hasResults = computed(() => dataResults.value.length > 0);
const totalSections = computed(() => (hasResults.value ? 3 : 2));
const hasImportedData = computed(() => data.value.length > 0);
const hasGeneratedData = computed(() => equations.value.length > 0 && data.value.length === 0);

const practiceCols = [
  { key: "letter", label: "Lettre" },
  { key: "count", label: "Nombre de rencontres" },
];

const associationCols = [
  { key: "equation", label: "Equation" },
  { key: "count", label: "Force d'associations" },
];

const practiceRows = computed(() =>
  Object.entries(practiceMap.value || {})
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => a.letter.localeCompare(b.letter)),
);

const associationRows = computed(() =>
  Object.entries(associationsMap.value || {})
    .map(([equation, count]) => ({ equation, count }))
    .sort((a, b) => a.equation.localeCompare(b.equation)),
);

// === Import des donnees et Génération d'équations ===

// Import centralisé des données depuis le composable
const { importData, exportTable } = useDataIO();

// Ferme le bouton "Générer des équations" quand des données sont importées
const closeEquationCollapse = () => {
  const collapse = document.querySelector("#equationParameters");
  const toggle = document.querySelector('[data-bs-target="#equationParameters"]');

  if (!collapse || !toggle) {
    return;
  }

  collapse.classList.remove("show");
  toggle.setAttribute("aria-expanded", "false");
  toggle.classList.add("collapsed");
  isEquationOpen.value = false;
};

const handleImportData = () =>
  importData(data, {
    onStart: () => {
      isImportingData.value = true;
    },
    onDone: () => {
      isImportingData.value = false;
      closeEquationCollapse();
      // Réinitialiser les paramètres aux valeurs par défaut avec les nouvelles données
      if (paramsForm.value && typeof paramsForm.value.resetParams === "function") {
        paramsForm.value.resetParams();
      }
      // Effacer les résultats précédents du lancement du modèle et de l'estimation des paramètres
      dataResults.value = [];
      practiceMap.value = {};
      associationsMap.value = {};
      estimationResultsRows.value = [];
      bestEstimatedParams.value = null;
    },
  });

const handleExportTable = (rows, columns, filename, format) =>
  exportTable(rows, {
    columns,
    filename,
    format,
  });

watch(data, (newData) => {
  if (newData.length > 0) {
    closeEquationCollapse();
  }
});

const handleGenerateEquations = async () => {
  const sessionsCount = Number(numSessions.value);
  const repetitionCount = Number(numRep.value);

  if (!Number.isInteger(sessionsCount) || sessionsCount < 1) {
    alert("Veuillez saisir un nombre de sessions valide (entier ≥ 1)");
    return false;
  }

  if (!Number.isInteger(repetitionCount) || repetitionCount < 1) {
    alert("Veuillez saisir un nombre de répétitions valide (entier ≥ 1)");
    return false;
  }

  const invalidAddend = (selectedAddends.value || []).find((addend) => {
    const num = Number(addend);
    return !Number.isInteger(num) || num < 0;
  });

  if (invalidAddend !== undefined) {
    alert("Veuillez vérifier les addends sélectionnés : certains ne sont pas des entiers valides");
    return false;
  }

  if (equationWorker.value) {
    equationWorker.value.terminate();
  }

  const worker = new Worker(
    new URL("./workers/equationWorker.js", import.meta.url),
    { type: "module" },
  );
  equationWorker.value = worker;

  let generatedEquations = [];

  try {
    generatedEquations = await new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const { type, result, message } = event.data || {};

        if (type === "result") {
          resolve(result || []);
        }

        if (type === "error") {
          reject(new Error(message));
        }
      };

      worker.onerror = (event) => {
        reject(new Error(event?.message || "Erreur worker"));
      };

      worker.postMessage({
        type: "generate",
        payload: {
          selectedAugends: Array.from(selectedAugends.value || []),
          selectedAddends: Array.from(selectedAddends.value || []),
          sessionsCount,
          repetitionCount,
        },
      });
    });
  } finally {
    if (equationWorker.value) {
      equationWorker.value.terminate();
      equationWorker.value = null;
    }
  }

  // Réinitialiser les paramètres aux valeurs par défaut avec les nouvelles données
  if (paramsForm.value && typeof paramsForm.value.resetParams === "function") {
    paramsForm.value.resetParams();
  }

  // Effacer les résultats précédents du lancement du modèle et de l'estimation des paramètres
  dataResults.value = [];
  practiceMap.value = {};
  associationsMap.value = {};
  estimationResultsRows.value = [];
  bestEstimatedParams.value = null;

  equations.value = generatedEquations;
  return true;
};

// Wrapper pour générer les équations puis fermer le panneau
const handleValidate = async () => {
  if (isGeneratingEquations.value) {
    return;
  }

  isGeneratingEquations.value = true;
  generationLoadingStartedAt.value = performance.now();

  let didGenerate = false;

  try {
    await nextTick();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    didGenerate = await handleGenerateEquations();
    if (didGenerate) {
      closeEquationCollapse();
    }
  } finally {
    if (!didGenerate) {
      isGeneratingEquations.value = false;
      generationLoadingStartedAt.value = 0;
      return;
    }

    const elapsed = performance.now() - generationLoadingStartedAt.value;
    if (elapsed < MIN_LOADING_DURATION_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING_DURATION_MS - elapsed),
      );
    }

    isGeneratingEquations.value = false;
    generationLoadingStartedAt.value = 0;
  }
};

// Ajoute un addend personnalisé à la liste des addends sélectionnés
const addCustomAddend = () => {
  const value = customAddendValue.value;
  
  // Valider que la valeur est un nombre valide
  const numValue = Number(value);
  if (!value || !Number.isFinite(numValue) || !Number.isInteger(numValue) || numValue < 6) {
    alert("Veuillez saisir un addend valide (entier supérieur ou égal à 6)");
    return;
  }

  // Vérifier que l'addend n'existe pas déjà
  if (allAvailableAddends.value.includes(String(numValue))) {
    alert("Cet addend est déjà dans la liste");
    return;
  }

  // Ajouter l'addend à la liste des custom addends et le cocher
  customAddends.value.push(String(numValue));
  selectedAddends.value.push(String(numValue));
  
  // Réinitialiser l'input et le masquer
  customAddendValue.value = "";
  showAddendInput.value = false;
};

const handleClearTable = (table) => {
  if (table === "equations") {
    equations.value = [];
  } else if (table === "data") {
    data.value = [];
  } 
};

// Transforme les lignes importees en stimuli pour le modèle
// Le temps n’est pas inclus car le modèle doit le prédire
const buildStimuli = (rows = data.value) =>
  rows.map((equation) => ({
    augend: String(equation.augend ?? "").trim(),
    addend: Number(equation.addend),
    result: String(equation.result ?? "").trim(),
    session: Number(equation.session ?? 1),
  }));

const currentInputEquations = computed(() =>
  equations.value.length > 0 ? equations.value : data.value,
);

// Label dynamique du bouton d'import de données selon qu'il y a déjà des données importées ou pas
const labelImportData = computed(() =>
  data.value.length > 0
    ? "Remplacer les données existantes"
    : "Importer les données existantes",
);

// Détecte les combinaisons d'augends et addends qui dépassent Z
const invalidCombinations = computed(() => {
  const invalid = [];
  selectedAugends.value.forEach(augend => {
    selectedAddends.value.forEach(addend => {
      const augendIndex = augend.charCodeAt(0) - 65;
      const resultIndex = augendIndex + parseInt(addend);
      if (resultIndex > 25) {
        invalid.push(`${augend} + ${addend}`);
      }
    });
  });
  return invalid;
});

// === Parametrage et lancement ===

// Référence au formulaire pour lui renvoyer les paramètres estimés
const paramsForm = ref(null);

// Limite l'index de section à une valeur valide pour éviter les erreurs de scroll
const clampSectionIndex = (index) =>
  Math.min(totalSections.value - 1, Math.max(0, index));

// Détecte la section la plus proche du centre de l'écran
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
  // On part d'une distance infinie pour trouver la section la plus proche
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

// Fait défiler la page jusqu'à la section demandée
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
const canGoDown = computed(() => currentSectionIndex.value < totalSections.value - 1);

// === Affichage des resultats ===

// Reformate les scores du modèle pour le tableau de l'interface
// Tri du tableau par RMSE croissant (meilleur score en premier)
const mapEstimationResultsRows = (evaluations) =>
  (evaluations || [])
    .map(({ score, paramsEstim }) => ({
      alpha: paramsEstim.alpha,
      beta: paramsEstim.beta,
      delta: paramsEstim.delta,
      eta: paramsEstim.eta,
      tau: paramsEstim.tau,
      rho: paramsEstim.rho,
      rmse: Number.isFinite(score) ? Number(score.toFixed(4)) : score,
    }))
    .sort(
      (a, b) =>
        (a.rmse ?? Number.POSITIVE_INFINITY) -
        (b.rmse ?? Number.POSITIVE_INFINITY),
    );

// Lance l'estimation des paramètres et garde l'interface réactive pendant le calcul
const handleLaunchEstimation = async ({
  paramsInit,
  paramsEstim,
  maxCombinations,
  maxRandomSamples,
  estimationMode,
}) => {
  if (!data.value.length) {
    alert("Aucun stimulus importé. Importez des équations avant de lancer l'estimation des paramètres.");
    dataResults.value = [];
    estimationResultsRows.value = [];
    return;
  }

  if (isEstimating.value) {
    return;
  }

  isEstimating.value = true;
  estimationResultsRows.value = [];

  try {
    const stimuli = data.value.map((row) => ({
      augend: String(row.augend ?? "").trim(),
      addend: Number(row.addend),
      result: String(row.result ?? "").trim(),
      time: Number(row.time),
      session: Number(row.session ?? 1),
    }));
    const model = new Model(paramsInit, paramsEstim, stimuli);
    currentEstimationModel.value = model;

    const combCount = model.countGridSearchCombinations();
    const maxCombinationsSafe =
      Number.isFinite(maxCombinations) && maxCombinations > 0
        ? Math.floor(maxCombinations)
        : 10000;

    if (estimationMode === "grid" && combCount > maxCombinationsSafe) {
      const confirmed = window.confirm(
        `Attention : ${combCount} combinaisons à évaluer. Cela peut prendre du temps. Continuer ?`,
      );

      if (!confirmed) {
        isEstimating.value = false;
        return;
      }
    }

    // Initialiser la progression à 0 avant de laisser le temps à l'interface de se mettre à jour
    const randomTarget =
      Number.isFinite(maxRandomSamples) && maxRandomSamples > 0
        ? Math.floor(maxRandomSamples)
        : 2000;
    const totalTarget =
      estimationMode === "grid"
        ? combCount
        : Math.min(randomTarget, combCount);
    estimationProgress.value = { current: 0, total: totalTarget };
    loadingStartedAt.value = performance.now();

    // Permettre à l'interface de se mettre à jour avant de lancer le calcul intensif
    await nextTick();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (estimationWorker.value) {
      estimationWorker.value.terminate();
    }

    const worker = new Worker(
      new URL("./workers/estimationWorker.js", import.meta.url),
      { type: "module" },
    );
    estimationWorker.value = worker;

    const { bestParams, evaluations } = await new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const { type, current, total, result, message } = event.data || {};

        if (type === "progress") {
          estimationProgress.value = {
            current,
            total: total ?? totalTarget,
          };
          return;
        }

        if (type === "result") {
          resolve(result);
        }

        if (type === "error") {
          reject(new Error(message));
        }
      };

      worker.onerror = (event) => {
        reject(new Error(event?.message || "Erreur worker"));
      };

      worker.postMessage({
        type: "estimate",
        payload: {
          paramsInit,
          paramsEstim,
          stimuli,
          mode: estimationMode,
          maxCombinations: maxCombinationsSafe,
          maxRandomSamples: randomTarget,
        },
      });
    });

    // Envoyer les meilleurs paramètres estimés au formulaire pour qu'il puisse les afficher
    if (
      paramsForm.value &&
      typeof paramsForm.value.setParamsEstim === "function"
    ) {
      paramsForm.value.setParamsEstim(bestParams);
    }

    // Mettre à jour le tableau des résultats d'estimation dans l'interface
    bestEstimatedParams.value = bestParams;
    estimationResultsRows.value = mapEstimationResultsRows(evaluations);
  } catch (error) {
    if (error.message !== "Estimation aborted by user") {
      alert("Impossible de lancer l'estimation des paramètres. " + error.message);
    }
    estimationResultsRows.value = [];
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
    currentEstimationModel.value = null;
    if (estimationWorker.value) {
      estimationWorker.value.terminate();
      estimationWorker.value = null;
    }
  }
};

// Permet d'interrompre le calcul long depuis l'interface en cliquant sur la croix du panneau de chargement
const handleCloseLoadingOverlay = () => {
  if (estimationWorker.value) {
    estimationWorker.value.postMessage({ type: "abort" });
    estimationWorker.value.terminate();
    estimationWorker.value = null;
  }

  isEstimating.value = false;
  estimationProgress.value = { current: 0, total: 0 };
  loadingStartedAt.value = 0;
  currentEstimationModel.value = null;
};

// Lance le modèle de calcul sur les données importées ou générées
const handleLaunchModel = async ({ paramsInit, paramsEstim }) => {
  if (!data.value.length && !equations.value.length) {
    alert("Aucun stimulus importé ni aucune équation générée. Importez ou générez des équations avant de lancer le modèle.");
    dataResults.value = [];
    return;
  }

  if (isModelRunning.value) {
    return;
  }

  isModelRunning.value = true;
  modelLoadingStartedAt.value = performance.now();
  modelProgress.value = { current: 0, total: 0 };

  try {
    await nextTick();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    const sourceEquations = equations.value.length > 0 ? equations.value : data.value;
    const stimuli = buildStimuli(sourceEquations);
    modelProgress.value = { current: 0, total: stimuli.length };

    if (modelWorker.value) {
      modelWorker.value.terminate();
    }

    const worker = new Worker(
      new URL("./workers/modelWorker.js", import.meta.url),
      { type: "module" },
    );
    modelWorker.value = worker;

    const { results, practice, associations } = await new Promise(
      (resolve, reject) => {
        worker.onmessage = (event) => {
          const { type, current, total, result, message } = event.data || {};

          if (type === "progress") {
            modelProgress.value = {
              current,
              total: total ?? stimuli.length,
            };
            return;
          }

          if (type === "result") {
            resolve(result);
          }

          if (type === "error") {
            reject(new Error(message));
          }
        };

        worker.onerror = (event) => {
          reject(new Error(event?.message || "Erreur worker"));
        };

        worker.postMessage({
          type: "runModel",
          payload: {
            paramsInit,
            paramsEstim,
            stimuli,
          },
        });
      },
    );

dataResults.value = results.map((result, index) => {
  // On vérifie si c'est une erreur
  const isError = result.method === "error" || result.time === null;

  // On crée un dictionnaire propre pour traduire la méthode
  const methodTranslations = {
    counting: "Comptage",
    retrieval: "Récupération",
    error: "Erreur"
  };

  return {
    id: index + 1,
    augend: result.augend,
    addend: result.addend,
    result: result.result,
    // Si c'est une erreur, on affiche "Échec", sinon on arrondit le temps
    time: isError ? "Échec" : Math.round(result.time),
    // On utilise le dictionnaire de traduction
    method: methodTranslations[result.method] || result.method,
    session: result.session,
  };
});

    practiceMap.value = { ...practice };
    associationsMap.value = { ...associations };

    // Scroll automatique vers la section des résultats après le lancement du modèle
    await nextTick();
    goToSection(2);
  } catch (error) {
    alert("Impossible de lancer le modèle. " + error.message);
    dataResults.value = [];
    practiceMap.value = {};
    associationsMap.value = {};
  } finally {
    const elapsed = performance.now() - modelLoadingStartedAt.value;
    if (elapsed < MIN_LOADING_DURATION_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_LOADING_DURATION_MS - elapsed),
      );
    }

    isModelRunning.value = false;
    modelProgress.value = { current: 0, total: 0 };
    modelLoadingStartedAt.value = 0;
    if (modelWorker.value) {
      modelWorker.value.terminate();
      modelWorker.value = null;
    }
  }
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

/* Snap scrolling */
.y-mandatory-scroll-snapping {
  scroll-snap-type: y mandatory;
  overflow-y: auto;
  height: 100vh;
  scroll-behavior: smooth;
  overscroll-behavior-y: none;
}

.scroll-nav {
  position: fixed;
  z-index: 1000;
  left: 50%;
  transform: translateX(-50%);
}

.scroll-nav-top {
  top: 1rem;
}

.scroll-nav-bottom {
  bottom: 1rem;
}

.scroll-nav button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 0;
  line-height: 1;
  border-radius: 999px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
  padding: 0 1.25rem; 
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
  min-height: 0;
}

/* Texte justifié */
.text-justify {
  text-align: justify;
}

/* Titres de section */
.section-title {
  margin-bottom: 1.5rem;
}

/* Cartes de section */
.section-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 1.25rem;
  padding: 1.25rem;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Carte de la première section */
.first-section-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 1.25rem;
  padding: 1.25rem;
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Section des résultats */
.results-section {
  justify-content: flex-start;
  padding-top: 3rem;
}

/* Listes d'équations */
.equation-lists {
  font-size: 0.875rem;
}

.augend-list .list-group-item,
.addend-list .list-group-item {
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}

.list-group-item, .list-group-item label, .list-group-item input {
  cursor: pointer;
}

.augend-list, .addend-list {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

/* Overlay de chargement */
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

.data-format-hint {
  text-align: center;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  white-space: normal;
  word-break: break-word;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<template>
  <main ref="mainScrollRef" class="y-mandatory-scroll-snapping">
    <div class="scroll-nav scroll-nav-top" aria-label="Navigation du scroll">
      <button
        v-if="canGoUp"
        type="button"
        class="btn bi bi-chevron-compact-up text-primary border-0 shadow-none fs-1"
        aria-label="Aller à la page précédente"
        @click="goToSection(currentSectionIndex - 1)"
      >
      </button>
    </div>

    <div class="scroll-nav scroll-nav-bottom" aria-label="Navigation du scroll">
      <button
        v-if="canGoDown"
        type="button"
        class="btn bi bi-chevron-compact-down text-primary border-0 shadow-none fs-1"
        aria-label="Aller à la page suivante"
        @click="goToSection(currentSectionIndex + 1)"
      >        
      </button>
    </div>

    <!-- === Import des donnees === -->
    <section class="snap-section">
      <div class="snap-section-inner container-lg">
        <h1 class="text-center section-title">
          Modélisation de l'apprentissage arithmétique
        </h1>
        <h2 class="text-center section-title small">
          Cette application vous permet, à partir de données de participants,
          d'optimiser les paramètres d'estimation et de générer les temps de réponse du modèle avec leur représentation graphique.
        </h2>
        <div class="first-section-card">
          <div class="d-flex flex-row justify-content-around">
            <div :class="isEquationOpen ? 'dropup' : 'dropdown'">
              <BaseButton
                variant="btn btn-outline-primary mb-3 dropdown-toggle"
                size="lg"
                data-bs-toggle="collapse"
                data-bs-target="#equationParameters"
                :aria-expanded="isEquationOpen"
                aria-controls="equationParameters"
                :disabled="data.length > 0"
                @click="isEquationOpen = !isEquationOpen"
              >
              Générer une liste d'équations
              </BaseButton>

              <!-- Informations sur la génération des équations -->
              <button
                class="btn btn-outline-secondary btn-sm bi bi-info-lg mb-3 ms-2 rounded-circle" 
                type="button" 
                title="Informations sur la génération des données"
                data-bs-toggle="modal" 
                data-bs-target="#modalInfos" 
              /> 
              <!-- Modal d'informations sur la génération des équations -->
              <div class="modal fade" id="modalInfos" role="dialog" aria-modal="true" aria-label="Informations sur la génération des données">
                <div class="modal-dialog">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h5 class="modal-title">Informations sur la génération des équations</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
                    </div>
                    <div class="modal-body">
                      <p class="text-justify">
                        Vous pouvez générer des données d'expérience en sélectionnant les augends et les addends 
                        que vous souhaitez inclure. Le résultat de chaque équation est calculé automatiquement 
                        (toutes les équations sont donc justes). Vous pouvez également spécifier le nombre de sessions 
                        et le nombre de répétitions pour chaque équation au sein d'une session. <br>L'ordre des équations 
                        au sein d'une session est aléatoire de façon à ce que 2 équations avec des augends similaires ne 
                        peuvent pas se suivre. Les équations générées seront affichées dans un tableau d'aperçu avant 
                        d'être utilisées pour le lancement du modèle.
                      </p>
                      <p class="text-danger">
                        Attention : en générant des équations, vous ne pourrez pas lancer d'estimation des paramètres, 
                        étant donné qu'il n'y a pas de temps de référence pour calculer des RMSE. Si vous souhaitez faire cela, 
                        vous devez importer des données existantes.
                      </p>
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                    </div>
                  </div>
                </div>
              </div>    

              <div
                v-if="data.length > 0"
                class="alert alert-warning py-2 mb-3 data-format-hint"
                role="alert"
              >
                Vous ne pouvez pas générer une liste d'équations car vous avez déjà importé des données.
              </div>

              <!-- Liste des augends -->
              <div class="equation-lists collapse" id="equationParameters">
                <label class="form-label">Sélectionnez les augends :</label>
                <div class="mb-2 d-flex gap-2">
                  <BaseButton
                    size="sm"
                    variant="btn btn-primary"
                    @click="selectedAugends = alphabetWithoutYZ.split('')"
                  >
                    Tout sélectionner
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-primary"
                    @click="selectedAugends = []"
                  >
                    Tout désélectionner
                  </BaseButton>
                </div>
                <ul class="list-group list-group-horizontal-sm flex-wrap mb-3 augend-list">
                  <li  class="list-group-item" 
                    v-for="x in alphabetWithoutYZ"
                    :key="x"
                  >
                    <input class="form-check-input me-1" type="checkbox" :value="x" :id="x" v-model="selectedAugends">
                    <label class="form-check-label stretched-link" :for="x">{{ x }}</label>
                  </li>    
                </ul>

                <!-- Liste des addends -->
                <label class="form-label">Sélectionnez les addends :</label>

                <div class="mb-2 d-flex gap-2">
                  <BaseButton
                    size="sm"
                    variant="btn btn-primary"
                    @click="selectedAddends = allAvailableAddends.slice()"
                  >
                    Tout sélectionner
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-primary"
                    @click="selectedAddends = []"
                  >
                    Tout désélectionner
                  </BaseButton>
                </div>
                
                <!-- changer l souris quand on passe sur la liste d'addend à cocher -->
                <div class="d-flex align-items-center gap-2">
                  <ul class="list-group list-group-horizontal-sm addend-list mb-3">
                    <li class="list-group-item" v-for="addend in allAvailableAddends" :key="addend">
                      <input class="form-check-input me-1" type="checkbox" :value="addend" :id="'addend-' + addend" v-model="selectedAddends">
                      <label class="form-check-label stretched-link" :for="'addend-' + addend">{{ addend }}</label>
                    </li>
                    <li class="list-group-item d-flex justify-content-center" @click="showAddendInput = !showAddendInput">
                      <label class="bi bi-plus-square text-primary"></label>
                    </li>
                  </ul>
                </div>

                <div class="d-flex align-items-center gap-2 mb-3">
                <input 
                  v-if="showAddendInput"
                  class="form-control" 
                  type="number" 
                  min="6"
                  placeholder="Saisir l'addend souhaité" 
                  v-model="customAddendValue"
                />
                <button
                  v-if="showAddendInput"
                  class="btn btn-outline-secondary"
                  @click="addCustomAddend"
                >
                  Ajouter
                </button>
                </div>

                <!-- Nombre de sessions -->
                <label class="form-label">Indiquez le nombre de sessions :</label>
                <input type="number" class="form-control mb-3" v-model.number="numSessions" min="1"/>

                <!-- Nombre de répétition d'une équation au sein d'une session -->
                <label class="form-label">Indiquez le nombre de répétitions d'une équation au sein d'une session :</label>
                <input type="number" class="form-control mb-3" v-model.number="numRep" min="1"/>

                <!-- Message d'erreur lorsque des combinaisons ne sont pas prises en compte -->
                <div 
                  v-if="invalidCombinations.length > 0" 
                  class="alert alert-warning mb-3 data-format-hint"                   
                  role="alert"
                >
                  <strong>Attention :</strong> Le résultat de certaines combinaisons dépasse Z. Celles-ci ne seront donc pas prises en compte dans le modèle. 
                  (<code>{{ invalidCombinations.join(", ") }}</code>)
                </div>

                <div class="d-flex align-items-center justify-content-center">
                  <BaseButton
                    variant="btn btn-outline-primary"
                    size="lg"
                    class="mb-3"
                    :hidden="selectedAugends.length === 0 || selectedAddends.length === 0"
                    :disabled="isGeneratingEquations"
                    @click="handleValidate"
                  >
                  <span v-if="isGeneratingEquations">Génération en cours...</span>
                  <span v-else>Valider</span>
                  </BaseButton>  
                </div>              
              </div>

              <div v-if="equations.length > 0" style="overflow-y: auto;">
                <BaseDataTable
                  title="Aperçu des équations générées"
                  :show-button="false"
                  :clearable="true"
                  max-height="40vh"
                  :rows="equations"
                  :columns="equationCols"
                  @clear="handleClearTable('equations')"
                />
                <div class="d-flex flex-wrap gap-2 mt-2">
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(equations, equationCols, 'equations', 'xlsx')"
                  >
                    Exporter XLSX
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(equations, equationCols, 'equations', 'csv')"
                  >
                    Exporter CSV
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(equations, equationCols, 'equations', 'json')"
                  >
                    Exporter JSON
                  </BaseButton>
                </div>
              </div>  
              
            </div>
            <div>
              <BaseDataTable
                title="Aperçu de vos données"
                :buttonLabel="labelImportData"
                max-height="40vh"
                :rows="data"
                :columns="dataCols"
                :is-loading="isImportingData"
                :clearable="true"
                :button-disabled="equations.length > 0"
                @import="handleImportData"
                @clear="handleClearTable('data')"
              />
              <p
                v-if="data.length === 0 && equations.length === 0"
                class="small text-muted mt-2 mb-0 data-format-hint"
              >
                Les données importées doivent être celles d'un participant avec au minimum les colonnes suivantes&nbsp;: Augend, Addend, Résultat, Session, Temps. Les formats acceptés pour le fichier sont XLSX, CSV et JSON.
              </p>
              <p
                v-if="data.length === 0 && equations.length === 0"
                class="small text-danger mt-0 data-format-hint"
              >
                Attention : les équations doivent être justes et le participant doit avoir répondu la bonne réponse aux équations, sans quoi le modèle ne pourra pas fonctionner.
              </p>
              <div
                v-if="equations.length > 0"
                class="alert alert-warning py-2 mt-2 mb-0 data-format-hint"
                role="alert"
              >
                Vous ne pouvez pas importer des données existantes car vous avez déjà généré une liste d'équations.
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isGeneratingEquations"
          class="loading-overlay"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            class="loading-panel d-flex flex-column align-items-center justify-content-center gap-3 position-relative"
          >
            <div
              class="loading-spinner"
              role="status"
              aria-label="Génération des équations"
            ></div>
            <p class="text-center mb-0 small text-muted">
              Génération des équations en cours...
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- === Parametrage et lancement === -->
    <section class="snap-section">
      <div class="snap-section-inner container-lg">
        <div class="section-card">
          <!-- Formulaire des paramètres d'initialisation et d'estimation -->
          <ParametersForm
            ref="paramsForm"
            :best-estimated-params="bestEstimatedParams"
            :estimation-results-rows="estimationResultsRows"
            :is-estimating="isEstimating"
            :is-model-running="isModelRunning"
            :data-imported="currentInputEquations"
            :has-imported-data="hasImportedData"
            :has-generated-data="hasGeneratedData"
            @launch-estimation="handleLaunchEstimation"
            @launch-model="handleLaunchModel"
            @export-estimation="({ rows, columns, format }) => handleExportTable(rows, columns, 'estimation-parametres', format)"
          />

          <!-- Barre de progression lors de l'estimation -->
          <div
            v-if="isEstimating"
            class="loading-overlay"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="loading-panel d-flex flex-column align-items-center justify-content-center gap-3 position-relative"
            >
              <button
                type="button"
                class="btn-close position-absolute top-0 end-0 m-2"
                aria-label="Fermer"
                @click="handleCloseLoadingOverlay"
              ></button>
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

          <div
            v-if="isModelRunning"
            class="loading-overlay"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="loading-panel d-flex flex-column align-items-center justify-content-center gap-3 position-relative"
            >
              <div
                class="loading-spinner"
                role="status"
                aria-label="Calcul du modèle"
              ></div>
              <p class="text-center mb-0 small text-muted">
                <span v-if="modelProgress.total > 0">
                  {{ modelProgress.current }} /
                  {{ modelProgress.total }} combinaisons traitées
                </span>
                <span v-else> Calcul des temps du modèle en cours... </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- === Affichage des resultats === -->
    <section v-if="hasResults" class="snap-section results-section">
      <div class="snap-section-inner container-lg">
        <div class="section-card d-flex flex-column">
          <div class="d-flex flex-row gap-4 align-items-center justify-content-center">
            <div class="d-flex flex-column gap-2">
            <BaseDataTable
              title="Tableau des temps prédits par le modèle pour chaque équation"
              buttonLabel="Sauvegarder les résultats"
              :show-button="false"
              max-height="65vh"
              :rows="dataResults"
              :columns="resultCols"
            />
            <div v-if="dataResults.length" class="d-flex flex-wrap gap-2">
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, resultCols, 'resultats', 'xlsx')"
              >
                Exporter XLSX
              </BaseButton>
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, resultCols, 'resultats', 'csv')"
              >
                Exporter CSV
              </BaseButton>
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, resultCols, 'resultats', 'json')"
              >
                Exporter JSON
              </BaseButton>
            </div>
            </div>

            <!-- Graphique des résultats -->
            <GraphicsResult
              :data="dataResults"
              :user-data="data"
              title="Moyennes des temps par session et addend (en ms)"
              @export-summary="({ rows, columns, format, filename }) => handleExportTable(rows, columns, filename || 'moyennes-sessions-addends', format)"
              @export-strategy-rates="({ rows, columns, format, filename }) => handleExportTable(rows, columns, filename || 'taux-strategie-comptage', format)"
            />
          </div>

          <div class="w-100" v-if="practiceRows.length || associationRows.length">
            <div class="d-flex flex-wrap gap-3">
              <div class="flex-grow-1" style="min-width: 280px;">
                <BaseDataTable
                  title="Nombre de rencontres par lettre"
                  :show-button="false"
                  max-height="30vh"
                  :rows="practiceRows"
                  :columns="practiceCols"
                />
                <div v-if="practiceRows.length" class="d-flex flex-wrap gap-2 mt-2">
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(practiceRows, practiceCols, 'nombre-rencontres-lettres', 'xlsx')"
                  >
                    Exporter XLSX
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(practiceRows, practiceCols, 'nombre-rencontres-lettres', 'csv')"
                  >
                    Exporter CSV
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(practiceRows, practiceCols, 'nombre-rencontres-lettres', 'json')"
                  >
                    Exporter JSON
                  </BaseButton>
                </div>
              </div>
              <div class="flex-grow-1" style="min-width: 280px;">
                <BaseDataTable
                  title="Force d'associations"
                  :show-button="false"
                  max-height="30vh"
                  :rows="associationRows"
                  :columns="associationCols"
                />
                <div v-if="associationRows.length" class="d-flex flex-wrap gap-2 mt-2">
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(associationRows, associationCols, 'force-associations', 'xlsx')"
                  >
                    Exporter XLSX
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(associationRows, associationCols, 'force-associations', 'csv')"
                  >
                    Exporter CSV
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="btn btn-outline-secondary"
                    @click="handleExportTable(associationRows, associationCols, 'force-associations', 'json')"
                  >
                    Exporter JSON
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
