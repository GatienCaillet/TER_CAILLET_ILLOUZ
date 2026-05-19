<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseDataTable from "./components/BaseDataTable.vue";
import GraphicsResult from "./components/GraphicsResult.vue";
import ParametersForm from "./components/ParametersForm.vue";
import { useDataIO } from "./composables/useDataIO.js";
import { Model } from "./model/Model";
import BaseButton from "./components/BaseButton.vue";

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

// État principal de l'application.
const equations = ref([]);
const data = ref([]);
const dataResults = ref([]);
const bestEstimatedParams = ref(null);
const estimationResultsRows = ref([]);
const isEstimating = ref(false);
const estimationProgress = ref({ current: 0, total: 0 });
const loadingStartedAt = ref(0);
const currentEstimationModel = ref(null);
const isImportingEquations = ref(false);
const isImportingData = ref(false);
const MIN_LOADING_DURATION_MS = 700;
const mainScrollRef = ref(null);
const currentSectionIndex = ref(0);
const isEquationOpen = ref(false);

const alphabetWithoutYZ = "ABCDEFGHIJKLMNOPQRSTUVWX";
const selectedAugends = ref([]);
const selectedAddends = ref([]);
const numSessions = ref(1);
const numRep = ref(1);

const hasResults = computed(() => dataResults.value.length > 0);
const totalSections = computed(() => (hasResults.value ? 3 : 2));
const hasImportedData = computed(() => data.value.length > 0);
const hasGeneratedData = computed(() => equations.value.length > 0 && data.value.length === 0);

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
  const generatedEquations = [];
  let id = 1;

  const shuffleInPlace = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  };

  // Générer toutes les combinaisons uniques
  const combinations = [];
  selectedAugends.value.forEach(augend => {
    selectedAddends.value.forEach(addend => {
      // Calculer le résultat de l'équation 
      const augendIndex = augend.charCodeAt(0) - 65; // position de l'augend dans l'alphabet
      const resultIndex = augendIndex + parseInt(addend);
      
      // Vérifie que le résultat ne dépasse pas Z
      if (resultIndex > 25) {
        
        return; // Ne tient pas compte de cette combinaison
      }
      
      const result = String.fromCharCode(65 + resultIndex);
      
      for (let rep = 1; rep <= numRep.value; rep++) {
        combinations.push({
          augend: augend,
          addend: parseInt(addend),
          result: result, 
        });
      }
    });
  });

  // Mettre les combinaisons dans un ordre aléatoire pour chaque session
  for (let session = 1; session <= numSessions.value; session++) {
    // Mélanger les combinaisons pour cette session
    const shuffledCombinations = shuffleInPlace([...combinations]);
    
    shuffledCombinations.forEach(combination => {
      generatedEquations.push({
        id: id++,
        augend: combination.augend,
        addend: combination.addend,
        result: combination.result,
        session: session,
      });
    });
  }

  equations.value = generatedEquations;
};

// Wrapper pour générer les équations puis fermer le panneau
const handleValidate = async () => {
  await handleGenerateEquations();
  closeEquationCollapse();
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
}) => {
  if (!data.value.length) {
    console.warn(
      "Aucun stimulus importé. Importez des équations avant de lancer l estimation des paramètres.",
    );
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
    const stimuli = buildStimuli();
    const model = new Model(paramsInit, paramsEstim, stimuli);
    currentEstimationModel.value = model;

    const combCount = model.countGridSearchCombinations();
    const maxCombinationsSafe =
      Number.isFinite(maxCombinations) && maxCombinations > 0
        ? Math.floor(maxCombinations)
        : 10000;

    if (combCount > maxCombinationsSafe) {
      const confirmed = window.confirm(
        `Attention : ${combCount} combinaisons à évaluer. Cela peut prendre du temps. Continuer ?`,
      );

      if (!confirmed) {
        isEstimating.value = false;
        return;
      }
    }

    // Initialiser la progression à 0 avant de laisser le temps à l'interface de se mettre à jour
    estimationProgress.value = { current: 0, total: combCount };
    loadingStartedAt.value = performance.now();

    // Permettre à l'interface de se mettre à jour avant de lancer le calcul intensif
    await nextTick();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Fonction de callback pour mettre à jour la progression depuis le modèle pendant l'estimation
    const onProgress = (current, total) => {
      estimationProgress.value = {
        current,
        total: total ?? combCount,
      };
    };

    // Lancer l'estimation des paramètres avec le modèle
    // C'est la partie la plus longue du processus
    const { bestParams, evaluations } = await model.estimateBestParamsWithScores(
      data.value,
      onProgress,
    );

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
      console.error("Impossible de lancer l estimation des paramètres:", error);
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
  }
};

// Permet d'interrompre le calcul long depuis l'interface en cliquant sur la croix du panneau de chargement
const handleCloseLoadingOverlay = () => {
  if (currentEstimationModel.value) {
    currentEstimationModel.value.shouldAbort = true;
  }

  isEstimating.value = false;
  estimationProgress.value = { current: 0, total: 0 };
  loadingStartedAt.value = 0;
  currentEstimationModel.value = null;
};

// Lance le modèle de calcul sur les données importées ou générées
const handleLaunchModel = async ({ paramsInit, paramsEstim }) => {
  if (!data.value.length && !equations.value.length) {
    console.warn(
      "Aucun stimulus importé ni aucune équation générée. Importez ou générez des équations avant de lancer le modèle.",
    );
    dataResults.value = [];
    return;
  }

  try {
    const sourceEquations = equations.value.length > 0 ? equations.value : data.value;
    const stimuli = buildStimuli(sourceEquations);
    const model = new Model(paramsInit, paramsEstim, stimuli);

    model.calculEveryStimulusTime(stimuli);

    dataResults.value = model.results.map((result, index) => ({
      id: index + 1,
      augend: result.augend,
      addend: result.addend,
      result: result.result,
      time: Math.round(result.time),
      session: result.session,
    }));

    // Scroll automatique vers la section des résultats après le lancement du modèle
    await nextTick();
    goToSection(2);
  } catch (error) {
    console.error("Impossible de lancer le modèle:", error);
    dataResults.value = [];
  }
};

// TODO : implémenter la sauvegarde des résultats dans un fichier
const handleSaveResults = () => {
  console.log("Btn sauvegarder résultats cliqué");
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
                        et le nombre de répétitions pour chaque équation au sein d'une session. Les équations générées 
                        seront affichées dans un tableau d'aperçu avant d'être utilisées pour le lancement du modèle.
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
                    @click="selectedAddends = ['2', '3', '4', '5']"
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

                <ul class="list-group list-group-horizontal-sm addend-list mb-3">
                  <li class="list-group-item">
                    <input class="form-check-input me-1" type="checkbox" value="2" id="2" v-model="selectedAddends">
                    <label class="form-check-label stretched-link" for="2">2</label>
                  </li>
                  <li class="list-group-item">
                    <input class="form-check-input me-1" type="checkbox" value="3" id="3" v-model="selectedAddends">
                    <label class="form-check-label stretched-link" for="3">3</label>
                  </li>
                  <li class="list-group-item">
                    <input class="form-check-input me-1" type="checkbox" value="4" id="4" v-model="selectedAddends">
                    <label class="form-check-label stretched-link" for="4">4</label>
                  </li>
                  <li class="list-group-item">
                    <input class="form-check-input me-1" type="checkbox" value="5" id="5" v-model="selectedAddends">
                    <label class="form-check-label stretched-link" for="5">5</label>
                  </li>
                </ul>

                <!-- Nombre de sessions -->
                <label class="form-label">Indiquez le nombre de sessions :</label>
                <input type="number" class="form-control mb-3" v-model="numSessions" min="1"/>

                <!-- Nombre de répétition d'une équation au sein d'une session -->
                <label class="form-label">Indiquez le nombre de répétitions d'une équation au sein d'une session :</label>
                <input type="number" class="form-control mb-3" v-model="numRep" min="1"/>

                <!-- Alerte pour les combinaisons invalides -->
                <div 
                  v-if="invalidCombinations.length > 0" 
                  class="alert alert-warning mb-3 data-format-hint" 
                  
                  role="alert"
                >
                  <strong>Attention :</strong> Le résultat de certaines combinaisons dépasse Z. Celles-ci ne seront donc pas prises en compte dans le modèle. 
                  (<code>{{ invalidCombinations.join(", ") }}</code>)
                </div>

                <BaseButton
                  variant="btn btn-outline-primary"
                  size="lg"
                  class="mb-3"
                  :hidden="selectedAugends.length === 0 || selectedAddends.length === 0"
                  @click="handleValidate"
                >
                Valider 
                </BaseButton>

                
              </div>

              <div v-if="equations.length > 0" style="overflow-y: auto;">
                <BaseButton
                  v-if="equations.length > 0"
                  size="sm"
                  variant="btn btn-outline-secondary"
                  @click="handleClearTable('equations')"
                >
                  Supprimer les données
                </BaseButton>

              <!-- Aperçu des équations générées -->
                <p class="mt-2 mb-0">Aperçu des équations générées :</p>
                <div class="table-responsive table-scroll" style="max-height: 45vh;">
                  <table 
                    v-if="equations.length > 0" 
                    class="table table-striped table-bordered"
                    id="equationsPreview"
                  >
                    <thead class="sticky-top">
                      <tr>
                        <th>#</th>
                        <th>Augend</th>
                        <th>Addend</th>
                        <th>Résultat</th>
                        <th>Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="equation in equations" :key="equation.id">
                        <td>{{ equation.id }}</td>
                        <td>{{ equation.augend }}</td>
                        <td>{{ equation.addend }}</td>
                        <td>{{ equation.result }}</td>
                        <td>{{ equation.session }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
                    @click="handleExportTable(equations, equationCols, 'equations', 'xls')"
                  >
                    Exporter XLS
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
                max-height="45vh"
                :rows="data"
                :columns="dataCols"
                :is-loading="isImportingData"
                :clearable="true"
                :button-disabled="equations.length > 0"
                @import="handleImportData"
                @clear="handleClearTable('data')"
              />
              <div v-if="data.length" class="d-flex flex-wrap gap-2 mt-2">
                <BaseButton
                  size="sm"
                  variant="btn btn-outline-secondary"
                  @click="handleExportTable(data, dataCols, 'donnees', 'xlsx')"
                >
                  Exporter XLSX
                </BaseButton>
                <BaseButton
                  size="sm"
                  variant="btn btn-outline-secondary"
                  @click="handleExportTable(data, dataCols, 'donnees', 'xls')"
                >
                  Exporter XLS
                </BaseButton>
                <BaseButton
                  size="sm"
                  variant="btn btn-outline-secondary"
                  @click="handleExportTable(data, dataCols, 'donnees', 'csv')"
                >
                  Exporter CSV
                </BaseButton>
                <BaseButton
                  size="sm"
                  variant="btn btn-outline-secondary"
                  @click="handleExportTable(data, dataCols, 'donnees', 'json')"
                >
                  Exporter JSON
                </BaseButton>
              </div>
              <p
                v-if="data.length === 0 && equations.length === 0"
                class="small text-muted mt-2 data-format-hint"
              >
                Les données importées doivent être celles d'un participant avec au minimum les colonnes suivantes&nbsp;: Augend, Addend, Résultat, Session, Temps
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
            :data-imported="currentInputEquations"
            :has-imported-data="hasImportedData"
            :has-generated-data="hasGeneratedData"
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
        </div>
      </div>
    </section>

    <!-- === Affichage des resultats === -->
    <section v-if="hasResults" class="snap-section results-section">
      <div class="snap-section-inner container-lg">
        <div class="section-card d-flex flex-row gap-4 align-items-center justify-content-center">
          <div class="d-flex flex-column gap-2">
            <BaseDataTable
              title="Tableau des résultats"
              buttonLabel="Sauvegarder les résultats"
              :show-button="false"
              max-height="70vh"
              :rows="dataResults"
              :columns="dataCols"
              @import="handleSaveResults"
            />
            <div v-if="dataResults.length" class="d-flex flex-wrap gap-2">
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, dataCols, 'resultats', 'xlsx')"
              >
                Exporter XLSX
              </BaseButton>
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, dataCols, 'resultats', 'xls')"
              >
                Exporter XLS
              </BaseButton>
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, dataCols, 'resultats', 'csv')"
              >
                Exporter CSV
              </BaseButton>
              <BaseButton
                size="sm"
                variant="btn btn-outline-secondary"
                @click="handleExportTable(dataResults, dataCols, 'resultats', 'json')"
              >
                Exporter JSON
              </BaseButton>
            </div>
          </div>

          <!-- Graphique des résultats -->
          <GraphicsResult :data="dataResults" title="Moyennes des temps par session et addend (en ms)" />
        </div>
      </div>
    </section>
  </main>
</template>
