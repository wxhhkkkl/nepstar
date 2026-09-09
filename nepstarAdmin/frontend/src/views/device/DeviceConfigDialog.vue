<template>
  <el-dialog
    :model-value="visible"
    :title="$t('device.configTitle') || '设备配置'"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div v-loading="loading">
      <!-- 配置库连接失败 -->
      <el-alert
        v-if="errorMsg"
        type="warning"
        :title="errorMsg"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button text type="primary" @click="fetchConfig">
            {{ $t('common.retry') || '重试' }}
          </el-button>
        </template>
      </el-alert>

      <!-- 无配置数据 -->
      <div v-if="!loading && !errorMsg && !hasData" class="empty-state">
        {{ $t('device.noConfigData') || '暂无配置数据' }}
      </div>

      <!-- QR 二维码 -->
      <div v-if="configData?.qr_url" class="config-section">
        <h4 class="section-title">{{ $t('device.qrCode') || '二维码' }}</h4>
        <div class="qr-wrapper">
          <img
            :src="configData.qr_url"
            :alt="$t('device.qrCode') || 'QR Code'"
            class="qr-image"
            @error="onQrError"
          />
        </div>
      </div>

      <!-- 设备上传信息 (tb_device_upload) -->
      <div v-if="configData?.device_upload" class="config-section">
        <h4 class="section-title">{{ $t('device.uploadInfo') || '设备上传信息' }}</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item
            v-for="(val, key) in displayFields(configData.device_upload)"
            :key="key"
            :label="key"
          >
            {{ val }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 上传详情 (tb_upload_info) -->
      <div v-if="configData?.upload_info" class="config-section">
        <h4 class="section-title">{{ $t('device.uploadDetail') || '上传详情' }}</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item
            v-for="(val, key) in displayFields(configData.upload_info)"
            :key="key"
            :label="key"
          >
            {{ val }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">
        {{ $t('common.close') || '关闭' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getDeviceConfig } from '@/api/devices';

const props = defineProps<{
  visible: boolean;
  device: any;
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
}>();

const loading = ref(false);
const errorMsg = ref('');
const configData = ref<any>(null);
const qrError = ref(false);

const hasData = computed(() => {
  const d = configData.value;
  return d && (d.qr_url || d.device_upload || d.upload_info);
});

// 排除连接键列（u_id, device_id），展示剩余列
function displayFields(data: Record<string, any>): Record<string, any> {
  const exclude = ['u_id', 'device_id', 'id'];
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!exclude.includes(k) && v !== null) {
      result[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  }
  return result;
}

function onQrError() {
  qrError.value = true;
}

async function fetchConfig() {
  if (!props.device?.ne_id) return;
  loading.value = true;
  errorMsg.value = '';
  configData.value = null;
  qrError.value = false;
  try {
    configData.value = await getDeviceConfig(props.device.ne_id);
  } catch (err: any) {
    errorMsg.value = err?.message || '配置数据暂不可用';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      fetchConfig();
    }
  },
);
</script>

<style scoped>
.config-section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 10px 0;
}
.qr-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}
.qr-image {
  max-width: 200px;
  max-height: 200px;
}
.empty-state {
  padding: 48px;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
}
</style>
