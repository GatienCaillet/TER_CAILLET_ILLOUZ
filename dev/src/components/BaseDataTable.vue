<script setup>
import { computed, ref, watch } from "vue";
import BaseButton from "./BaseButton.vue";

// Tableau réutilisable pour afficher des données, avec chargement et tri optionnel
const props = defineProps({
  title: String,
  buttonLabel: String,
  rows: { type: Array, default: () => [] },
  columns: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  showButton: { type: Boolean, default: true },
  hideButtonWhenEmpty: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  buttonDisabled: { type: Boolean, default: false },
  sortable: { type: Boolean, default: false },
  initialSortKey: { type: String, default: null },
  initialSortDirection: { type: String, default: "asc" },
  maxHeight: { type: String, default: "100%" },
  pagination: { type: Boolean, default: true },
  pageSize: { type: Number, default: 200 },
  pageSizeOptions: {
    type: Array,
    default: () => [50, 200, 500, 1000],
  },
});

const normalizeDirection = (value) => (value === "desc" ? "desc" : "asc");
const sortKey = ref(props.initialSortKey);
const sortDirection = ref(normalizeDirection(props.initialSortDirection));
const currentPage = ref(1);
const currentPageSize = ref(props.pageSize);

// Convertit une cellule en valeur comparable, quelle que soit sa forme d'origine
const toSortableValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = String(value).trim();
  const parsed = Number.parseFloat(text);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return text.toLowerCase();
};

const sortedRows = computed(() => {
  if (!props.sortable || !sortKey.value) {
    return props.rows;
  }

  const direction = sortDirection.value === "asc" ? 1 : -1;
  return [...props.rows].sort((a, b) => {
    const aValue = toSortableValue(a?.[sortKey.value]);
    const bValue = toSortableValue(b?.[sortKey.value]);

    if (aValue === null && bValue === null) {
      return 0;
    }
    if (aValue === null) {
      return 1 * direction;
    }
    if (bValue === null) {
      return -1 * direction;
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      if (aValue === bValue) {
        return 0;
      }
      return aValue > bValue ? 1 * direction : -1 * direction;
    }

    if (aValue === bValue) {
      return 0;
    }
    return aValue > bValue ? 1 * direction : -1 * direction;
  });
});

const totalRows = computed(() => sortedRows.value.length || 0);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRows.value / Math.max(1, currentPageSize.value))),
);
const shouldPaginate = computed(
  () => props.pagination && totalRows.value > currentPageSize.value,
);
const pageStartIndex = computed(() =>
  (currentPage.value - 1) * currentPageSize.value,
);
const pageEndIndex = computed(() =>
  Math.min(pageStartIndex.value + currentPageSize.value, totalRows.value),
);
const displayRows = computed(() => {
  if (!shouldPaginate.value) {
    return sortedRows.value;
  }

  return sortedRows.value.slice(pageStartIndex.value, pageEndIndex.value);
});

const clampPage = (value) =>
  Math.min(Math.max(1, value), totalPages.value);

const goToPrevPage = () => {
  currentPage.value = clampPage(currentPage.value - 1);
};

const goToNextPage = () => {
  currentPage.value = clampPage(currentPage.value + 1);
};

const handlePageSizeChange = (event) => {
  const nextSize = Number(event.target.value);
  currentPageSize.value = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : props.pageSize;
  currentPage.value = 1;
};

watch(
  () => props.rows,
  () => {
    currentPage.value = 1;
  },
);

watch(
  () => props.pageSize,
  (nextSize) => {
    const normalized = Number(nextSize);
    if (Number.isFinite(normalized) && normalized > 0) {
      currentPageSize.value = normalized;
      currentPage.value = 1;
    }
  },
);

watch(
  totalPages,
  (newTotal) => {
    if (currentPage.value > newTotal) {
      currentPage.value = newTotal;
    }
  },
);

// Gère le clic sur un en-tête de colonne pour changer le tri
const handleSort = (key) => {
  if (!props.sortable) {
    return;
  }
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDirection.value = "asc";
  }
};

// Affiche une petite flèche à côté de la colonne triée
const sortIndicator = (key) => {
  if (!props.sortable || sortKey.value !== key) {
    return "";
  }
  return sortDirection.value === "asc" ? " ▲" : " ▼";
};

// Le parent déclenche les actions d'import et de suppression via ces événements
defineEmits(["import", "clear"]);
</script>

<template>
  <div class="table-wrapper">
    <div class="d-flex gap-2 align-items-center justify-content-center">
      <BaseButton
        v-if="showButton && (!hideButtonWhenEmpty || rows.length)"
        :disabled="isLoading || buttonDisabled"
        size="lg"
        variant="btn btn-outline-primary"
        @click="$emit('import')"
      >
        {{ buttonLabel }}
      </BaseButton>

      <BaseButton
        v-if="clearable && rows.length"
        size="sm"
        variant="btn btn-outline-secondary"
        @click="$emit('clear')"
      >
        Supprimer les données
      </BaseButton>
    </div>

    <div v-if="title && rows.length">{{ title }} :</div>

    <div
      v-if="isLoading"
      class="d-flex align-items-center justify-content-center border rounded-2 py-4 mt-2"
    >
      <span
        aria-hidden="true"
        class="spinner-border text-primary me-2"
        role="status"
      ></span>
      <span class="text-muted">Import en cours...</span>
    </div>

    <div v-else-if="rows.length" class="table-container">
      <div
        class="table-responsive table-scroll"
        :style="{ maxHeight: props.maxHeight }"
      >
        <table class="table table-striped table-bordered">
          <thead class="sticky-top">
            <tr>
              <th v-for="col in columns" :key="col.key" scope="col">
                <button
                  v-if="sortable"
                  class="btn btn-link p-0 text-decoration-none"
                  type="button"
                  @click="handleSort(col.key)"
                >
                  {{ col.label }}{{ sortIndicator(col.key) }}
                </button>
                <span v-else>{{ col.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody class="table-group-divider">
            <tr v-for="(row, index) in displayRows" :key="index">
              <td
                v-for="col in columns"
                :key="col.key"
                :class="row.__cellClasses?.[col.key]"
              >
                {{ row[col.key] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="shouldPaginate" class="pagination-controls">
        <div class="pagination-info">
          Lignes {{ pageStartIndex + 1 }}–{{ pageEndIndex }} / {{ totalRows }}
        </div>
        <div class="d-flex align-items-center gap-2">
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            :disabled="currentPage <= 1"
            @click="goToPrevPage"
          >
            Précédent
          </button>
          <span class="pagination-page">Page {{ currentPage }} / {{ totalPages }}</span>
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            :disabled="currentPage >= totalPages"
            @click="goToNextPage"
          >
            Suivant
          </button>
          <label class="pagination-size">
            <span class="me-1">Lignes/page</span>
            <select
              class="form-select form-select-sm"
              :value="currentPageSize"
              @change="handlePageSizeChange"
            >
              <option
                v-for="option in pageSizeOptions"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.table-scroll {
  flex: 1 1 auto;
  max-height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.table-scroll .table {
  margin-bottom: 0;
}

.pagination-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.25rem 0.25rem;
}

.pagination-info {
  color: #6c757d;
  font-size: 0.9rem;
}

.pagination-page {
  font-weight: 600;
}

.pagination-size {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pagination-size .form-select {
  width: auto;
}
</style>
