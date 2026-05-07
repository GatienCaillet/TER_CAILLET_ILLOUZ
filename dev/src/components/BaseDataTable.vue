<template>
  <div class="table-wrapper">
    <BaseButton
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
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="table-group-divider">
          <tr v-for="(row, index) in rows" :key="index">
            <td v-for="col in columns" :key="col.key">
              {{ row[col.key] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import BaseButton from "./BaseButton.vue";

defineProps({
  title: String,
  buttonLabel: String,
  rows: { type: Array, default: () => [] },
  columns: { type: Array, required: true },
  isLoading: { type: Boolean, default: false },
});

// Envoi à components/ParametersForm.vue l'information que les inputs ont été modifiés
defineEmits(["import"]);
</script>
