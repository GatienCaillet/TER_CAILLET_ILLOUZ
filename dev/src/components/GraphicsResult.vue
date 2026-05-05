<script setup>
import { ref, watch, onMounted } from 'vue'
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

const svgRef = ref(null)
const containerRef = ref(null)

// Fonction pour transformer les données brutes en données agrégées
const aggregateData = (rawData) => {
  if (!rawData || !rawData.length) return { lineData: [], tableData: [], addends: [], sessions: [] }

  // Créer une structure pour regrouper les données par addend et session
  const grouped = {}
  
  rawData.forEach(item => {
    const addend = item.addend
    const session = item.session
    const time = item.time
    
    if (!grouped[addend]) {
      grouped[addend] = {}
    }
    if (!grouped[addend][session]) {
      grouped[addend][session] = []
    }
    grouped[addend][session].push(time)
  })

  // Calculer la moyenne pour chaque addend et session
  const addends = Object.keys(grouped).sort((a, b) => Number(a) - Number(b))
  const sessions = new Set()
  
  rawData.forEach(item => sessions.add(item.session))
  const sortedSessions = Array.from(sessions).sort((a, b) => a - b)

  // Préparer les données pour les lignes du graphique (une ligne par session)
  const lineData = sortedSessions.map(session => ({
    session,
    values: addends.map(addend => ({
      addend: Number(addend),
      avgTime: d3.mean(grouped[addend][session] || [0])
    }))
  }))

  // Préparer les données pour le tableau (une ligne par session, une colonne par addend)
  const tableData = sortedSessions.map(session => {
    const row = { session }
    addends.forEach(addend => {
      const times = grouped[addend][session] || []
      row[`addend_${addend}`] = times.length > 0 ? Math.round(d3.mean(times)) : '-'
    })
    return row
  })

  return { lineData, tableData, addends: addends.map(Number), sessions: sortedSessions }
}

// Fonction pour dessiner le graphique
const drawChart = () => {
  if (!svgRef.value || !props.data || !props.data.length) return

  const { lineData, addends, sessions } = aggregateData(props.data)

  if (!lineData.length || !addends.length) return

  // Dimensions du graphique
  const margin = { top: 20, right: 30, bottom: 50, left: 60 }
  const width = Math.max(600, containerRef.value?.clientWidth || 800) - margin.left - margin.right
  const height = 400 - margin.top - margin.bottom

  // Vider le SVG précédent
  d3.select(svgRef.value).selectAll('*').remove()

  // Créer le SVG
  const svg = d3.select(svgRef.value)
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Échelles
  const xScale = d3.scalePoint()
    .domain(addends)
    .range([0, width])
    .padding(0.5)

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(lineData, line => d3.max(line.values, d => d.avgTime)) * 1.1])
    .range([height, 0])

  // Couleurs pour les différentes sessions
  const colorScale = d3.scaleOrdinal()
    .domain(sessions)
    .range(d3.schemeCategory10)

  // Générateur de ligne
  const line = d3.line()
    .x(d => xScale(d.addend))
    .y(d => yScale(d.avgTime))

  // Ajouter les axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .append('text')
    .attr('x', width / 2)
    .attr('y', 30)
    .attr('fill', 'black')
    .attr('text-anchor', 'middle')
    .text('Addend')

  svg.append('g')
    .call(d3.axisLeft(yScale))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -45)
    .attr('fill', 'black')
    .attr('text-anchor', 'middle')
    .text('Temps moyen (ms)')

  // Tracer les lignes (une par session)
  lineData.forEach(lineItem => {
    svg.append('path')
      .datum(lineItem.values)
      .attr('fill', 'none')
      .attr('stroke', colorScale(lineItem.session))
      .attr('stroke-width', 2.5)
      .attr('d', line)

    // Ajouter les points
    svg.selectAll(`.dot-${lineItem.session}`)
      .data(lineItem.values)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.addend))
      .attr('cy', d => yScale(d.avgTime))
      .attr('r', 4)
      .attr('fill', colorScale(lineItem.session))
  })

  // Ajouter une légende
  const legend = svg.selectAll('.legend')
    .data(sessions)
    .enter()
    .append('g')
    .attr('class', 'legend')
    .attr('transform', (d, i) => `translate(${width - 100}, ${i * 20})`)

  legend.append('rect')
    .attr('width', 18)
    .attr('height', 18)
    .attr('fill', colorScale)

  legend.append('text')
    .attr('x', 24)
    .attr('y', 9)
    .attr('dy', '.35em')
    .style('font-size', '12px')
    .text(d => `Session ${d}`)
}

// Redessiner quand les données changent
watch(() => props.data, async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  drawChart()
}, { deep: true, immediate: true })

onMounted(async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  drawChart()
})
</script>

<template>
  <div class="graphics-container my-4" ref="containerRef">
    <div v-if="data && data.length" class="chart-section">
      <h3 class="text-center mb-3">{{ title }}</h3>
      <svg ref="svgRef" class="chart-svg"></svg>
      
      <!-- Tableau récapitulatif -->
      <div class="table-section mt-4">
        <h5 class="mb-2">Moyennes des temps par session et addend (en ms)</h5>
        <table class="table table-sm table-bordered">
          <thead class="table-light">
            <tr>
              <th>Session</th>
              <th v-for="addend in aggregateData(data).addends" :key="addend">
                +{{ addend }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in aggregateData(data).tableData" :key="row.session">
              <td class="fw-bold">{{ row.session }}</td>
              <td v-for="addend in aggregateData(data).addends" :key="addend">
                {{ row[`addend_${addend}`] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="alert alert-light text-center">
      Aucune donnée à afficher. Lancez le modèle pour générer des résultats.
    </div>
  </div>
</template>

<style scoped>
.graphics-container {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-svg {
  width: 100%;
  height: auto;
  background: white;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.chart-section {
  display: flex;
  flex-direction: column;
}

.table-section {
  background: white;
  padding: 1rem;
  border-radius: 4px;
}

.table {
  margin-bottom: 0;
}

h3 {
  color: #2c3e50;
  font-weight: 600;
}

h5 {
  color: #34495e;
  font-weight: 600;
}
</style>
