<script setup>
import { ref } from 'vue'
import AppInput from './AppInput.vue'

// Les valeurs réelles
const params = ref({
  encodingTime: 80,
  comparaisonTime: 200,
  commandTime: 300,
  errorRate: 5,
  alphaTime: 20
})

// La configuration des champs pour le v-for
const configInitialisation = [
  { id: 'encoding-time', label: "Temps d'encodage (ms)", key: 'encodingTime' },
  { id: 'comparaison-time', label: "Temps de comparaison (ms)", key: 'comparaisonTime' },
  { id: 'command-time', label: "Temps commande moteur (ms)", key: 'commandTime' },
  { id: 'error-rate', label: "Taux d'erreur (%)", key: 'errorRate' },
]
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
    </form>
  </div>
</template>