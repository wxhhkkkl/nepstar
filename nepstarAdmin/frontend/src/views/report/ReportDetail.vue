<template>
  <div class="page"><el-card v-loading="loading">
    <template #header><div class="header"><span>{{ $t('menu.inspectionReport') }} - {{ report?.report_name }}</span><el-button @click="$router.back()">{{ $t('common.back') }}</el-button></div></template>
    <el-descriptions v-if="report" border :column="3">
      <el-descriptions-item :label="$t('report.reportNo')">{{ report.report_name }}</el-descriptions-item>
      <el-descriptions-item :label="$t('report.detectTime')">{{ report.detect_time }}</el-descriptions-item>
      <el-descriptions-item :label="$t('report.totalScore')"><el-tag type="warning">{{ report.total_score }}</el-tag></el-descriptions-item>
    </el-descriptions>
    <el-table :data="items" border style="margin-top:20px" empty-text="-">
      <el-table-column prop="item_name" :label="$t('report.itemName')" />
      <el-table-column prop="detect_value" :label="$t('report.detectValue')" />
      <el-table-column prop="score" :label="$t('report.score')" />
    </el-table>
  </el-card></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'; import { useRoute } from 'vue-router'; import api from '@/api/client';
const route=useRoute();const report=ref<any>(null);const items=ref<any[]>([]);const loading=ref(false);
async function fetch(){loading.value=true;const rid=route.params.id as string;const r=await api.get(`/reports/${rid}`);report.value=r.data.report;items.value=r.data.items;loading.value=false;}
onMounted(fetch);
</script>
<style scoped>.page{padding:20px}.header{display:flex;justify-content:space-between;align-items:center}</style>
