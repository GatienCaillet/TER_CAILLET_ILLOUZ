<script setup>
// Bouton générique réutilisable dans toute l'interface
defineProps({
  variant: {
    type: String,
    default: "primary", // Couleur Bootstrap du bouton
  },
  size: {
    type: String,
    default: "", // Tailles Bootstrap autorisées : sm, lg ou vide pour taille normale
    validator: (value) => ["", "sm", "lg"].includes(value),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// L'événement est déclaré explicitement pour éviter un double déclenchement
defineEmits(["click"]);
</script>

<template>
  <button
    :class="['btn', `btn-outline-${variant}`, size ? `btn-${size}` : '']"
    :disabled="disabled"
    type="button"
    @click="$emit('click', $event)"
  >
  <!-- slot affiche ici le texte ou l'icone fournis entre les balises BaseButton -->
    <slot />
  </button>
</template>