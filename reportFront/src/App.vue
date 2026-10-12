<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="AiConsult">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>
