<script setup lang="ts">
import QRCode from 'qrcode';
import { ref, watchEffect } from 'vue';

const props = defineProps<{ value: string; label: string }>();
const src = ref('');

// Drawn here in the browser: the secret never goes to a third-party QR service.
watchEffect(() => {
  void QRCode.toDataURL(props.value, { margin: 1, width: 192, errorCorrectionLevel: 'M' }).then(
    (url) => {
      src.value = url;
    },
  );
});
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="label"
    width="192"
    height="192"
    class="rounded-borders"
    style="background: #fff; padding: 8px"
  />
</template>
