<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";

// Graphique de synthèse des temps mesurés par session et par addend
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

const svgRef = ref(null);
const chartContainerRef = ref(null);

// Regroupe les données brutes pour préparer à la fois le tableau et le tracé
const aggregateData = (rawData) => {
  if (!rawData || !rawData.length) {
    return { lineData: [], tableData: [], addends: [], sessions: [] };
  }

  const grouped = {};

  rawData.forEach((item) => {
    const addend = item.addend;
    const session = item.session;
    const time = item.time;

    if (!grouped[addend]) {
      grouped[addend] = {};
    }
    if (!grouped[addend][session]) {
      grouped[addend][session] = [];
    }
    grouped[addend][session].push(time);
  });

  const addends = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
  const sessions = new Set();

  rawData.forEach((item) => sessions.add(item.session));
  const sortedSessions = Array.from(sessions).sort((a, b) => a - b);

  // Une ligne du graphique correspond à une session.
  const lineData = sortedSessions.map((session) => ({
    session,
    values: addends.map((addend) => ({
      addend: Number(addend),
      avgTime: d3.mean(grouped[addend][session] || [0]),
    })),
  }));

  // Une ligne du tableau récapitule les moyennes pour une session donnée
  const tableData = sortedSessions.map((session) => {
    const row = { session };
    addends.forEach((addend) => {
      const times = grouped[addend][session] || [];
      row[`addend_${addend}`] = times.length > 0 ? d3.mean(times).toFixed(2) : "-";
    });
    return row;
  });

  return { lineData, tableData, addends: addends.map(Number), sessions: sortedSessions };
};

// Dessine le graphique D3 à partir des données agrégées
const drawChart = () => {
  if (!svgRef.value || !props.data || !props.data.length) {
    return;
  }

  const { lineData, addends, sessions } = aggregateData(props.data);

  if (!lineData.length || !addends.length) {
    return;
  }

  // On retire l'ancien tooltip avant d'en recréer un
  d3.select("body").selectAll(".d3-tooltip").remove();

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("padding", "5px 10px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("z-index", "1000");

  const legendItems = sessions.map((session) => ({
    session,
    label: `Session ${session}`,
  }));
  const maxLegendLabel = Math.max(...legendItems.map((item) => item.label.length), 1);

  // Les dimensions s'adaptent à la largeur du conteneur
  const margin = { top: 8, right: 30, bottom: 40, left: 60 };
  const containerWidth = chartContainerRef.value?.clientWidth || 800;
  const legendWidth = Math.min(100, Math.max(140, Math.round(maxLegendLabel * 8 + 40)));
  const minChartWidth = 400;
  const width = Math.max(minChartWidth, containerWidth - margin.left - margin.right - legendWidth);
  const minChartHeight = window.innerHeight * 0.25;
  const plotHeight = Math.max(minChartHeight, window.innerHeight * 0.25);
  const height = plotHeight;

  // Nettoie le SVG pour éviter de superposer plusieurs rendus
  d3.select(svgRef.value).selectAll("*").remove();

  const svg = d3
    .select(svgRef.value)
    .attr("width", width + margin.left + margin.right + legendWidth)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xScale = d3.scalePoint().domain(addends).range([0, width]).padding(0.5);

  const yScale = d3
    .scaleLinear()
    .domain([
      d3.min(lineData, (line) => d3.min(line.values, (d) => d.avgTime)) / 1.1,
      d3.max(lineData, (line) => d3.max(line.values, (d) => d.avgTime)) * 1.1,
    ])
    .range([height, 0]);

  // Une couleur par session pour rendre la lecture plus simple.
  const colorScale = d3.scaleOrdinal().domain(sessions).range(d3.schemeCategory10);

  const line = d3
    .line()
    .x((d) => xScale(d.addend))
    .y((d) => yScale(d.avgTime));

  // Axe horizontal
  const xAxisOffset = 0;

  svg
    .append("g")
    .attr("transform", `translate(0,${height - xAxisOffset})`)
    .call(d3.axisBottom(xScale).tickPadding(6))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 22)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .text("Addend");

  // Axe vertical
  svg
    .append("g")
    .call(d3.axisLeft(yScale))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .text("Temps moyen (ms)");

  // Tracé principal: une courbe par session
  lineData.forEach((lineItem) => {
    svg
      .append("path")
      .datum(lineItem.values)
      .attr("fill", "none")
      .attr("stroke", colorScale(lineItem.session))
      .attr("stroke-width", 2.5)
      .attr("d", line);

    // Chaque point peut afficher une infobulle au survol
    svg.selectAll(null)
      .data(lineItem.values)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.addend))
      .attr("cy", (d) => yScale(d.avgTime))
      .attr("r", 4)
      .attr("fill", colorScale(lineItem.session))
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        tooltip.style("visibility", "visible").text(`${d.avgTime.toFixed(2)} ms`);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", `${event.pageY + 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
      });
  });

  // Légende à droite du graphique
  const legend = svg
    .selectAll(".legend")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", (d, i) => `translate(${width + 20}, ${i * 22})`);

  legend
    .append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", (d) => colorScale(d.session));

  legend
    .append("text")
    .attr("x", 24)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("font-size", "11px")
    .text((d) => d.label);
};

// Le graphique se met à jour dès que les données changent
watch(() => props.data, async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  drawChart();
}, { deep: true, immediate: true });

onMounted(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  drawChart();
  window.addEventListener("resize", handleResize, { passive: true });
});

let resizeFrame = 0;
const handleResize = () => {
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame);
  }
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    drawChart();
  });
};

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame);
  }
});
</script>

<template>
  <div class="graphics-container">
    <div v-if="data && data.length" class="chart-section">
      <h5 class="text-center mb-3">{{ title }}</h5>
      <div ref="chartContainerRef">
        <svg ref="svgRef" class="chart-svg"></svg>
      </div>
      
      <!-- Tableau récapitulatif -->
      <div class="table-section">
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
  max-height: 85vh;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-svg {
  background: white;
  height: auto;
  overflow: visible;
}

.chart-section {
  display: flex;
  flex-direction: column;
}

.table-section {
  background: white;
  padding: 1rem;
  border-radius: 4px;
  max-height: 30vh;
  overflow-y: auto;
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
