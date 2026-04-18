<script setup>
import { ref } from 'vue'
import BaseDataTable from './components/BaseDataTable.vue'
import ParametersForm from './components/ParametersForm.vue'
import GraphicsResult from './components/GraphicsResult.vue'
import { useDataImporter } from './composables/useDataImporter.js'
import { Model } from './model/Model'

// Définition des colonnes pour le tableau des équations à donner au modèle
const equationCols = [
  { key: 'id', label: '#' },
  { key: 'augend', label: 'Augend' },
  { key: 'addend', label: 'Addend' },
  { key: 'result', label: 'Résultat' }
]

// Définition des colonnes pour les données existantes (en reprenant les colonnes des équations + des colonnes supplémentaires)
const dataCols = [
  ...equationCols, // On reprend la structure précédente
  { key: 'time', label: 'Temps' },
  { key: 'session', label: 'Session' }
]

// Définition des ref pour les équations et les données
const equations = ref([])
const data = ref([]) 
const dataResults = ref([]) 

// Récupération des fonctions depuis le composable (composables/useDataImporter.js)
const { importEquations, importData } = useDataImporter()

// Handlers qui appellent la logique du composable
const handleImportEquations = () => importEquations(equations)
const handleImportData = () => importData(data)

// Logique pour lancer l'estimation des paramètres (à implémenter)
const handleLaunchEstimation = () => {
  console.log('Btn lancer estimation des paramètres clicked')
}

// Logique pour lancer le modèle (à implémenter)
const handleLaunchModel = ({ paramsInit, paramsEstim }) => {
  if (!data.value.length) {
    console.warn('Aucun stimulus importé. Importez des équations avant de lancer le modèle.')
    dataResults.value = []
    return
  }

  try {
    // Mapping des lignes du tableau vers le format attendu par Model.js
    const stimuli = data.value.map((equation) => ({
      augend: String(equation.augend ?? '').trim(),
      addend: Number(equation.addend),
      result: String(equation.result ?? '').trim(),
      session: Number(equation.session ?? 1)
    }))

    const model = new Model(paramsInit, paramsEstim, stimuli)
    model.calculEveryStimulusTime(stimuli)

    // Mapping inverse pour afficher les résultats dans la table de l'UI
    dataResults.value = model.results.map((result, index) => ({
      id: index + 1,
      augend: result.augend,
      addend: result.addend,
      result: result.result,
      time: Math.round(result.temps),
      session: result.session
    }))

    console.log('Modèle exécuté. Résultats générés :', dataResults.value)
  } catch (error) {
    console.error('Impossible de lancer le modèle:', error)
    dataResults.value = []
  }
}

// Logique pour sauvegarder les résultats (à implémenter)
const handleSaveResults = () => {
  console.log('Btn sauvegarder résultats clicked')
}
</script>

<template>
  <main>
    <h1 class="text-center my-4">Modélisation de l'apprentissage arithmétique</h1>
    <div class="d-flex justify-content-around">
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

    <!-- Formulaire des paramètres d'initialisation et d'estimation -->
    <ParametersForm
      @launch-estimation="handleLaunchEstimation"
      @launch-model="handleLaunchModel"
    />

    <hr/>
    
    <BaseDataTable 
      title="Tableau des résultats"
      buttonLabel="Sauvegarder les résultats"
      :rows="dataResults"
      :columns="dataCols"
      @import="handleSaveResults"
    />

    <!-- Graphique des résultats -->
    <GraphicsResult 
      :data="dataResults"
      title="Graphique des résultats"
    />
  </main>
</template>
