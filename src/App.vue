<script setup lang="ts">
import IgnisMark from '@/components/IgnisMark.vue';
import RecoveryCodesDialog from '@/components/RecoveryCodesDialog.vue';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
</script>

<template>
  <!-- While the refresh cookie is tried, show the brand instead of a blank page. -->
  <div v-if="!session.ready" class="ig-splash" role="status" aria-live="polite">
    <IgnisMark :size="52" class="ig-splash__mark" />
  </div>
  <router-view v-else />
  <RecoveryCodesDialog />
</template>
