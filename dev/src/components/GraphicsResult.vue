<script setup>
import { ref} from 'vue'
import * as d3 from 'd3'

// Définition des props
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Graphique des résultats'
  }
})
</script>

<template>
  <div class="graphics-container my-4">

  </div>
</template>

<style scoped>

</style>
