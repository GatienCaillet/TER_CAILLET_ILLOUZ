<script setup>
// Champ numérique adaptable : simple ou avec plage d'estimation
defineProps({
  id: String,
  label: String,
  modelValue: Number,
  min: Number,
  max: Number,
  pas: Number,
  enabled: {
    type: Boolean,
    default: false,
  },
  showRange: {
    type: Boolean,
    default: false,
  },
  rangeDisabled: {
    type: Boolean,
    default: false,
  },
});

// Tous les changements de valeur remontent au parent via ces événements
defineEmits([
  "update:modelValue",
  "update:min",
  "update:max",
  "update:pas",
  "update:enabled",
]);
</script>

<template>
  <div v-if="showRange" class="col-6 px-3">
    <div class="m-3">
      <label :for="id" class="form-label">{{ label }}</label>
      <input
        :id="id"
        class="form-control"
        type="number"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.valueAsNumber)"
      />
    </div>

    <div class="d-flex flex-row gap-2 align-items-center">
      <input
        :checked="enabled"
        class="form-check-input"
        type="checkbox"
        :disabled="rangeDisabled"
        @click.stop
        @change="$emit('update:enabled', $event.target.checked)"
      />

      <fieldset
        :disabled="rangeDisabled"
        class="d-flex flex-row gap-2 align-items-center border-3 p-0 m-0"
        :class="{
          'opacity-50': !enabled || rangeDisabled,
          'cursor-pointer': !rangeDisabled,
          'cursor-not-allowed': rangeDisabled,
        }"
        @click="!enabled && !rangeDisabled && $emit('update:enabled', true)"
      >
      <!-- &nbsp; est un espace inseparable pour éviter le retour a la ligne -->
        <label class="shrink-0">Min&nbsp;:</label>
        <div>
          <input
            :id="id"
            :value="min"
            class="form-control"
            type="number"
            :disabled="rangeDisabled"
            @focus="!enabled && !rangeDisabled && $emit('update:enabled', true)"
            @input="$emit('update:min', $event.target.valueAsNumber)"
          />
        </div>

        <label class="shrink-0">Max&nbsp;:</label>
        <div>
          <input
            :id="id"
            :value="max"
            class="form-control"
            type="number"
            :disabled="rangeDisabled"
            @focus="!enabled && !rangeDisabled && $emit('update:enabled', true)"
            @input="$emit('update:max', $event.target.valueAsNumber)"
          />
        </div>

        <label class="shrink-0">Pas&nbsp;:</label>
        <div>
          <input
            :id="id"
            :value="pas"
            class="form-control"
            min="1"
            step="1"
            type="number"
            :disabled="rangeDisabled"
            @focus="!enabled && !rangeDisabled && $emit('update:enabled', true)"
            @input="$emit('update:pas', $event.target.valueAsNumber)"
          />
        </div>
      </fieldset>
    </div>
  </div>

  <div v-else class="m-3">
    <label :for="id" class="form-label">{{ label }}</label>
    <input
      :id="id"
      class="form-control"
      type="number"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.valueAsNumber)"
    />
  </div>
</template>

<style scoped>
  
.form-check-input, .cursor-pointer, .cursor-pointer label {
  cursor: pointer;
}
</style>
