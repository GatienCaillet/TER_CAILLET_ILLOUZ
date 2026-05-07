<template>
  <div class="table-wrapper">
    <BaseButton
      v-if="!hideButtonWhenEmpty || rows.length"
      variant="btn btn-outline-primary"
      size="lg"
      :disabled="isLoading"
      @click="$emit('import')"
    >
      {{ buttonLabel }}
    </BaseButton>
    <div v-if="title && rows.length">{{ title }} :</div>
    <div
      v-if="isLoading"
      class="d-flex align-items-center justify-content-center border rounded-2 py-4 mt-2"
    >
      <span
        class="spinner-border text-primary me-2"
        role="status"
        aria-hidden="true"
      ></span>
      <span class="text-muted">Import en cours...</span>
    </div>
    <div
      v-else-if="rows.length"
      class="table-responsive"
      style="overflow-y: scroll; max-height: calc(100vh - 20rem)"
    >
      <table class="table table-striped table-bordered">
        <thead class="sticky-top">
          <tr>
            <th v-for="col in columns" :key="col.key" scope="col">
              <button
                v-if="sortable"
                type="button"
                class="btn btn-link p-0 text-decoration-none"
                @click="handleSort(col.key)"
              >
                {{ col.label }}{{ sortIndicator(col.key) }}
              </button>
              <span v-else>{{ col.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="table-group-divider">
          <tr v-for="(row, index) in sortedRows" :key="index">
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
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import BaseButton from "./BaseButton.vue";

const props = defineProps({
  title: String,
  buttonLabel: String,
  rows: { type: Array, default: () => [] },
  columns: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
  hideButtonWhenEmpty: { type: Boolean, default: false },
  sortable: { type: Boolean, default: false },
  initialSortKey: { type: String, default: null },
  initialSortDirection: { type: String, default: "asc" },
});

const normalizeDirection = (value) => (value === "desc" ? "desc" : "asc");
const sortKey = ref(props.initialSortKey);
const sortDirection = ref(normalizeDirection(props.initialSortDirection));

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

const sortIndicator = (key) => {
  if (!props.sortable || sortKey.value !== key) {
    return "";
  }
  return sortDirection.value === "asc" ? " ▲" : " ▼";
};

// Envoi à components/ParametersForm.vue l'information que les inputs ont été modifiés
defineEmits(["import"]);
</script>
