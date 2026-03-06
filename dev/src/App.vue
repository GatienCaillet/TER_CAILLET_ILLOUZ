<script setup>
import { ref } from 'vue'
import BaseDataTable from './components/BaseDataTable.vue'
import ParametersForm from './components/ParametersForm.vue'
import { useDataImporter } from './composables/useDataImporter.js'

// Définition des colonnes pour les équations
const equationCols = [
  { key: 'id', label: '#' },
  { key: 'augend', label: 'Augend' },
  { key: 'addend', label: 'Addend' },
  { key: 'result', label: 'Résultat' }
]

// Définition des colonnes pour les données (en reprenant les colonnes des équations + des colonnes supplémentaires)
const dataCols = [
  ...equationCols, // On reprend la structure précédente
  { key: 'time', label: 'Temps' },
  { key: 'session', label: 'Session' }
]

// Données fictives (placeholders) pour les équations et les données
const equations = ref([])

const data = ref([])

// Récupération des fonctions depuis le composable
const { importEquations, importData } = useDataImporter()

// Handlers qui appellent la logique du composable
const handleImportEquations = () => importEquations(equations)
const handleImportData = () => importData(data)

const handleLanchEstimation = () => {
  // Logique pour lancer l'estimation des paramètres (à implémenter)
  console.log('Btn lancer estimation des paramètres clicked')
}

const handleLanchModel = () => {
  // Logique pour lancer le modèle (à implémenter)
  console.log('Btn lancer le modèle clicked')
}

const handleSaveResults = () => {
  // Logique pour sauvegarder les résultats (à implémenter)
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
    <ParametersForm
      @lanch-estimation="handleLanchEstimation"
      @lanch-model="handleLanchModel"
    />
    
    <BaseDataTable 
      title="Tableau des résultats"
      buttonLabel="Sauvegarder les résultats"
      :rows="data"
      :columns="dataCols"
      @import="handleSaveResults"
    />
  </main>
</template>

<style scoped>

</style>
