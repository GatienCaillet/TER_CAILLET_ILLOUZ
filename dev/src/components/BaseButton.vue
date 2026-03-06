<template>
  <button
    type="button"
    :class="[
      'btn', 
      `btn-outline-${variant}`,
      size ? `btn-${size}` : '' 
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
// Définition des props
defineProps({
  variant: {
    type: String,
    default: 'primary' // Bootstrap: primary, secondary, success, danger, warning, info, light, dark
  },
  size: {
    type: String,
    default: '', // Bootstrap: sm, lg
    validator: (value) => ['', 'sm', 'lg'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>