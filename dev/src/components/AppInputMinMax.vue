<script setup>
import AppInput from "./AppInput.vue";

defineProps({
  label: String,
  id: String,
  min: Number,
  max: Number,
  pas: Number,
  enabled: Boolean,
  modelValue: Number, // La valeur transmise par le parent
});

// Envoi à components/ParametersForm.vue l'information que les inputs ont été modifiés
defineEmits([
  "update:modelValue",
  "update:min",
  "update:max",
  "update:pas",
  "update:enabled",
]);
</script>

<template>
  <div class="col-6 p-3">
    <AppInput
      :id="id"
      :label="label"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
    <div class="d-flex flex-row gap-2 align-items-center">
      <input
        type="checkbox"
        class="form-check-input"
        :checked="enabled"
        @click.stop
        @change="$emit('update:enabled', $event.target.checked)"
      />

      <fieldset
        @click="!enabled && $emit('update:enabled', true)"
        class="d-flex flex-row gap-2 align-items-center border-3 p-0 m-0"
        :class="{ 'opacity-50': !enabled, 'cursor-pointer': !enabled }"
      >
        <label class="flex-shrink-0">Min :</label>
        <div class="">
          <input
            type="number"
            class="form-control"
            :id="id"
            :value="min"
            @focus="!enabled && $emit('update:enabled', true)"
            @input="$emit('update:min', $event.target.valueAsNumber)"
          />
        </div>

        <label class="flex-shrink-0">Max :</label>
        <div class="">
          <input
            type="number"
            class="form-control"
            :id="id"
            :value="max"
            @focus="!enabled && $emit('update:enabled', true)"
            @input="$emit('update:max', $event.target.valueAsNumber)"
          />
        </div>
        <label class="flex-shrink-0">Pas :</label>
        <div class="">
          <input
            type="number"
            class="form-control"
            :id="id"
            min="1"
            step="1"
            :value="pas"
            @focus="!enabled && $emit('update:enabled', true)"
            @input="$emit('update:pas', Math.max(1, Number.isFinite($event.target.valueAsNumber) ? $event.target.valueAsNumber : 1))"
          />
        </div>
      </fieldset>
    </div>
  </div>
</template>
