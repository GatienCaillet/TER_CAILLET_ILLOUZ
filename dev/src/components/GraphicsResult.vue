<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import BaseDataTable from "./BaseDataTable.vue";
import BaseButton from "./BaseButton.vue";

// Graphique de synthèse des temps mesurés par session et par addend
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  userData: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Graphique des résultats'
  }
})

const emit = defineEmits(["export-summary", "export-strategy-rates"]);

const svgRef = ref(null);
const chartContainerRef = ref(null);
const activeTab = ref('temps');
const activeDataset = ref('modele');

const hasUserData = computed(() => (props.userData || []).length > 0);
const activeRawData = computed(() =>
  activeDataset.value === "utilisateur" ? props.userData : props.data,
);
const activeHasData = computed(() => (activeRawData.value || []).length > 0);
const showStrategyTab = computed(() => activeDataset.value === "modele");
const exportSuffix = computed(() =>
  activeDataset.value === "utilisateur" ? "utilisateur" : "modele",
);

// Regroupe les données brutes pour préparer à la fois le tableau et le tracé
const aggregateData = (rawData) => {
  if (!rawData || !rawData.length) {
    return { lineData: [], tableData: [], addends: [], sessions: [] };
  }

  const grouped = {};

  rawData.forEach((item) => {
    if (
      item.method === "error" || 
      item.method === "Erreur" || 
      item.time === null || 
      item.time === undefined
    ) {
      return; 
    }

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

const aggregated = computed(() => aggregateData(activeRawData.value));
const tableRows = computed(() => aggregated.value.tableData || []);
const tableColumns = computed(() => {
  const addends = aggregated.value.addends || [];
  return [
    { key: "session", label: "Session" },
    ...addends.map((addend) => ({
      key: `addend_${addend}`,
      label: `+${addend}`,
    })),
  ];
});

const legendItems = computed(() => {
  const sessions = aggregated.value.sessions || [];
  const colorScale = d3.scaleOrdinal().domain(sessions).range(d3.schemeCategory10);
  return sessions.map((session) => ({
    session,
    label: `Session ${session}`,
    color: colorScale(session),
  }));
});

// Calcule les taux de stratégie de comptage par session et addend
const strategyRatesData = computed(() => {
  if (!showStrategyTab.value) {
    return [];
  }

  const { addends, sessions } = aggregated.value;
  if (!addends || !sessions) return [];
  
  return sessions.map((session) => {
    const row = { session };
    addends.forEach((addend) => {
      const pointData = activeRawData.value.filter(
        (item) => item.session === session && item.addend === addend
      );
      
      const correctPoints = pointData.filter(
        (item) => item.method !== "error" && item.method !== "Erreur" && item.time !== null
      );

      if (pointData.length > 0) {
        const counting = pointData.filter((item) => item.method === "Comptage").length;
        const total = pointData.length;
        const percentage = ((counting / total) * 100).toFixed(1);
        row[`addend_${addend}`] = `${percentage}%`;
      } else {
        row[`addend_${addend}`] = "-";
      }
    });
    return row;
  });
});

const strategyRatesColumns = computed(() => {
  const addends = aggregated.value.addends || [];
  return [
    { key: "session", label: "Session" },
    ...addends.map((addend) => ({
      key: `addend_${addend}`,
      label: `+${addend}`,
    })),
  ];
});

const handleExportSummary = (format) => {
  emit("export-summary", {
    rows: tableRows.value,
    columns: tableColumns.value,
    filename: `moyennes-sessions-addends-${exportSuffix.value}`,
    format,
  });
};

const handleExportStrategyRates = (format) => {
  emit("export-strategy-rates", {
    rows: strategyRatesData.value,
    columns: strategyRatesColumns.value,
    filename: `taux-strategie-comptage-${exportSuffix.value}`,
    format,
  });
};

const buildExportSvgString = () => {
  const svgEl = svgRef.value;
  if (!svgEl) {
    return null;
  }

  const legend = legendItems.value || [];
  const clone = svgEl.cloneNode(true);
  const serializer = new XMLSerializer();

  if (!legend.length) {
    return serializer.serializeToString(clone);
  }

  const baseWidth = Number(clone.getAttribute("width")) || 800;
  const baseHeight = Number(clone.getAttribute("height")) || 600;
  const padding = 12;
  const itemHeight = 18;
  const swatchSize = 12;
  const legendWidth = 160;
  const legendHeight = Math.max(24, legend.length * itemHeight + padding);
  const newWidth = baseWidth + legendWidth + padding * 2;

  clone.setAttribute("width", newWidth);

  const ns = "http://www.w3.org/2000/svg";
  const legendGroup = document.createElementNS(ns, "g");
  legendGroup.setAttribute(
    "transform",
    `translate(${baseWidth + padding}, ${padding})`,
  );

  const background = document.createElementNS(ns, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(legendWidth));
  background.setAttribute("height", String(legendHeight));
  background.setAttribute("fill", "#ffffff");
  background.setAttribute("stroke", "#e5e7eb");
  background.setAttribute("rx", "4");
  legendGroup.appendChild(background);

  legend.forEach((item, index) => {
    const y = padding + index * itemHeight + 6;

    const swatch = document.createElementNS(ns, "rect");
    swatch.setAttribute("x", String(padding));
    swatch.setAttribute("y", String(y - 8));
    swatch.setAttribute("width", String(swatchSize));
    swatch.setAttribute("height", String(swatchSize));
    swatch.setAttribute("fill", item.color);
    swatch.setAttribute("rx", "2");
    legendGroup.appendChild(swatch);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(padding + swatchSize + 6));
    label.setAttribute("y", String(y + 2));
    label.setAttribute("font-size", "12");
    label.setAttribute("font-family", "sans-serif");
    label.setAttribute("fill", "#111827");
    label.textContent = item.label;
    legendGroup.appendChild(label);
  });

  clone.appendChild(legendGroup);
  return serializer.serializeToString(clone);
};

const handleExportSvg = () => {
  const svgString = buildExportSvgString();
  if (!svgString) {
    return;
  }
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `graphique-resultats-${exportSuffix.value}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleExportPng = () => {
  const svgString = buildExportSvgString();
  if (!svgString) {
    return;
  }
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/);
  const width = widthMatch ? Number(widthMatch[1]) : 800;
  const height = heightMatch ? Number(heightMatch[1]) : 600;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        URL.revokeObjectURL(url);
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `graphique-resultats-${exportSuffix.value}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
  };

  img.src = url;
};

// Dessine le graphique D3 à partir des données agrégées
const drawChart = () => {
  const rawData = activeRawData.value || [];

  if (!svgRef.value || !rawData.length) {
    return;
  }

  const { lineData, addends, sessions } = aggregateData(rawData);

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
    .style("padding", "8px 12px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("max-width", "200px")
    .style("white-space", "pre-wrap");

  // Fonction pour calculer les taux de stratégies pour un point donné
  const getStrategyRates = (session, addend) => {
    const pointData = rawData.filter(
      (item) => item.session === session && item.addend === addend
    );
    
    const correctPoints = pointData.filter(
    (item) => item.method !== "error" && item.method !== "Erreur" && item.time !== null
  );
  
    if (!pointData.length) return { counting: 0, retrieval: 0, total: 0, countingPct: 0, retrievalPct: 0 };
    
    const counting = pointData.filter((item) => item.method === "Comptage").length;
    const retrieval = pointData.filter((item) => item.method === "Récupération").length;
    const total = pointData.length;
    
    return {
      counting,
      retrieval,
      total,
      countingPct: ((counting / total) * 100).toFixed(1),
      retrievalPct: ((retrieval / total) * 100).toFixed(1)
    };
  };

  // Les dimensions s'adaptent à la largeur du conteneur
  const margin = { top: 8, right: 30, bottom: 40, left: 60 };
  const width = window.innerWidth * 0.21;
  const height = window.innerHeight * 0.25;

  // Nettoie le SVG pour éviter de superposer plusieurs rendus
  d3.select(svgRef.value).selectAll("*").remove();

  const svg = d3
    .select(svgRef.value)
    .attr("width", width + margin.left + margin.right)
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
        const tooltipText = showStrategyTab.value
          ? (() => {
              const rates = getStrategyRates(lineItem.session, d.addend);
              return `${d.avgTime.toFixed(2)} ms\nTaux de comptage: ${rates.countingPct}%\nTaux de récupération: ${rates.retrievalPct}%`;
            })()
          : `${d.avgTime.toFixed(2)} ms`;
        tooltip.style("visibility", "visible").html(tooltipText.split("\n").join("<br/>"));
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
};

// Le graphique se met à jour dès que les données changent
watch(
  () => [props.data, props.userData, activeDataset.value],
  async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  drawChart();
  },
  { deep: true, immediate: true },
);

watch(hasUserData, (value) => {
  if (!value && activeDataset.value !== "modele") {
    activeDataset.value = "modele";
  }
});

watch(activeDataset, (value) => {
  if (value !== "modele" && activeTab.value === "tauxStrategie") {
    activeTab.value = "temps";
  }
});

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
    <div v-if="activeHasData" class="chart-section">
      <h5 class="text-center mb-3">{{ title }}</h5>
      <ul v-if="hasUserData" class="nav nav-tabs mb-3">
        <li class="nav-item">
          <a
            :class="['nav-link', { active: activeDataset === 'modele' }]"
            href="#modele"
            @click.prevent="activeDataset = 'modele'"
          >
            Temps du modèle
          </a>
        </li>
        <li class="nav-item">
          <a
            :class="['nav-link', { active: activeDataset === 'utilisateur' }]"
            href="#utilisateur"
            @click.prevent="activeDataset = 'utilisateur'"
          >
            Temps utilisateurs
          </a>
        </li>
      </ul>
      <div ref="chartContainerRef" class="chart-container">
        <svg ref="svgRef" class="chart-svg"></svg>
        <div v-if="legendItems.length" class="legend-container">
          <div v-for="item in legendItems" :key="item.session" class="legend-item">
            <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-2 mb-3">
        <BaseButton
          size="sm"
          variant="btn btn-outline-secondary"
          @click="handleExportSvg"
        >
          Exporter SVG
        </BaseButton>
        <BaseButton
          size="sm"
          variant="btn btn-outline-secondary"
          @click="handleExportPng"
        >
          Exporter PNG
        </BaseButton>
      </div>      

      <ul v-if="showStrategyTab" class="nav nav-tabs">
        <li class="nav-item">
          <a
            :class="['nav-link', { active: activeTab === 'temps' }]"
            href="#temps"
            @click.prevent="activeTab = 'temps'"
          >
            Temps moyens
          </a>
        </li>
        <li class="nav-item">
          <a
            :class="['nav-link', { active: activeTab === 'tauxStrategie' }]"
            href="#tauxStrategie"
            @click.prevent="activeTab = 'tauxStrategie'"
          >
            Taux de stratégie de comptage
          </a>
        </li>
      </ul>

      <!-- Tableau récapitulatif des temps de réponse -->
      <div class="tab-content">
        <div v-if="activeTab === 'temps'" class="table-section" id="temps">
          <BaseDataTable
            title=""
            :show-button="false"
            max-height="25vh"
            :rows="tableRows"
            :columns="tableColumns"
          />
          <div v-if="tableRows.length" class="d-flex flex-wrap gap-2 mt-2">
            <BaseButton
              size="sm"
              variant="btn btn-outline-secondary"
              @click="handleExportSummary('xlsx')"
            >
              Exporter XLSX
            </BaseButton>
            <BaseButton
              size="sm"
              variant="btn btn-outline-secondary"
              @click="handleExportSummary('csv')"
            >
              Exporter CSV
            </BaseButton>
            <BaseButton
              size="sm"
              variant="btn btn-outline-secondary"
              @click="handleExportSummary('json')"
            >
              Exporter JSON
            </BaseButton>
          </div>
      </div>

      <!-- Tableau récapitulatif des taux de comptage -->
      <div
        v-if="showStrategyTab && activeTab === 'tauxStrategie'"
        class="table-section"
        id="tauxStrategie"
      >
        <BaseDataTable
          title=""
          :show-button="false"
          max-height="25vh"
          :rows="strategyRatesData"
          :columns="strategyRatesColumns"
        />
        <div v-if="strategyRatesData.length" class="d-flex flex-wrap gap-2 mt-2">
          <BaseButton
            size="sm"
            variant="btn btn-outline-secondary"
            @click="handleExportStrategyRates('xlsx')"
          >
            Exporter XLSX
          </BaseButton>
          <BaseButton
            size="sm"
            variant="btn btn-outline-secondary"
            @click="handleExportStrategyRates('csv')"
          >
            Exporter CSV
          </BaseButton>
          <BaseButton
            size="sm"
            variant="btn btn-outline-secondary"
            @click="handleExportStrategyRates('json')"
          >
            Exporter JSON
          </BaseButton>
        </div>
      </div>
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
  max-width: 40vw;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-svg {
  background: white;
}

.chart-container {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.legend-container {
  max-height: 30vh;
  overflow-y: auto;
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
  min-width: 140px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  margin-bottom: 0.4rem;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.chart-section {
  display: flex;
  flex-direction: column;
}

.table-section {
  background: white;
  padding-inline: 1rem;
  padding-bottom: 1rem;
  border-radius: 4px;
  max-height: 40vh;
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
