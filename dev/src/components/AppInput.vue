<script setup>
defineProps({
  label: String,
  id: String,
  modelValue: Number // La valeur transmise par le parent
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="m-3">
    <label :for="id" class="form-label">{{ label }}</label>
    <input 
      type="number" 
      class="form-control" 
      :id="id" 
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.valueAsNumber)"
    >
  </div>
</template>