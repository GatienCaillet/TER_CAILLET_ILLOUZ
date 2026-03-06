<template>
  <div class="table-wrapper">
    <BaseButton variant="btn btn-outline-primary" size="lg" :disabled="false" @click="$emit('import')">
      {{ buttonLabel }}
    </BaseButton>
    <div>{{ title }} :</div>

    <table class="table table-striped table-bordered">
      <thead>
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
</template>

<script setup>
import BaseButton from "./BaseButton.vue";

defineProps({
  title: String,
  buttonLabel: String,
  rows: { type: Array, default: () => [] },
  columns: { type: Array, required: true },
});

defineEmits(["import"]);
</script>
