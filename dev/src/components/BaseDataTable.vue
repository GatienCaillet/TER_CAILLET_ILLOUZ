<template>
  <div class="table-wrapper">
    <BaseButton
      variant="btn btn-outline-primary"
      size="lg"
      :disabled="false"
      @click="$emit('import')"
    >
      {{ buttonLabel }}
    </BaseButton>
    <div>{{ title }} :</div>
    <div class="table-responsive" style="overflow-y: scroll; max-height: 250px">
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
});

// Envoi à components/ParametersForm.vue l'information que les inputs ont été modifiés
defineEmits(["import"]);
</script>
