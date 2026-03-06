<script setup>
import AppInput from "./AppInput.vue";
import { ref } from "vue";

defineProps({
  label: String,
  id: String,
  min: Number,
  max: Number,
  pas: Number,
  modelValue: Number, // La valeur transmise par le parent
});

// Envoi à components/ParametersForm.vue l'information que les inputs ont été modifiés
defineEmits(["update:modelValue", "update:min", "update:max", "update:pas"]);

// Par défaut, la partie "min" "max" et "pas" est désactivée (false)
const isEnabled = ref(false);
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
      <input type="checkbox" class="form-check-input" v-model="isEnabled" />

      <fieldset
        :disabled="!isEnabled"
        class="d-flex flex-row gap-2 align-items-center border-0 p-0 m-0"
      >
        <label class="flex-shrink-0">Min :</label>
        <div class="">
          <input
            type="number"
            class="form-control"
            :id="id"
            :value="min"
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
            @input="$emit('update:max', $event.target.valueAsNumber)"
          />
        </div>
        <label class="flex-shrink-0">Pas :</label>
        <div class="">
          <input
            type="number"
            class="form-control"
            :id="id"
            :value="pas"
            @input="$emit('update:pas', $event.target.valueAsNumber)"
          />
        </div>
      </fieldset>
    </div>
  </div>
</template>
