<template>
  <el-dialog
    :model-value="visible"
    :title="$t('device.editTitle') || '编辑设备'"
    width="650px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form ref="formRef" :model="form" label-width="120px" @submit.prevent="handleSave">
      <!-- 可编辑部分 -->
      <el-divider content-position="left">{{ $t('device.basicInfo') || '基本信息' }}</el-divider>

      <el-form-item :label="$t('device.deviceName') || '设备名称'">
        <el-input :model-value="device?.device_name" disabled />
      </el-form-item>

      <el-form-item :label="$t('device.orgName') || '所属组织'">
        <el-select
          v-model="form.org_id"
          :placeholder="$t('device.selectOrg') || '请选择组织'"
          style="width: 100%"
          clearable
          filterable
        >
          <el-option
            v-for="org in flatOrgs"
            :key="org.id"
            :label="org.label"
            :value="org.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('device.reportLanguage') || '报告语言'">
        <el-select
          v-model="form.report_language"
          :placeholder="$t('device.selectLanguage') || '请选择语言'"
          style="width: 100%"
        >
          <el-option label="中文 (zh-CN)" value="zh-CN" />
          <el-option label="English (en)" value="en" />
          <el-option label="Español (es)" value="es" />
        </el-select>
      </el-form-item>

      <!-- 硬件配置信息（只读，来自 fast_plus 配置库 tb_upload_info / tb_device_upload） -->
      <el-divider content-position="left">{{ $t('device.hardwareInfo') || '硬件配置信息' }}</el-divider>

      <div v-if="configLoading" style="text-align:center;padding:12px;color:#c0c4cc;font-size:13px">
        {{ $t('common.loading') || '加载中...' }}
      </div>
      <template v-else>
        <el-form-item
          v-for="item in configItems"
          :key="item.label"
          :label="item.label"
        >
          <el-input :model-value="item.value" disabled />
        </el-form-item>
        <div v-if="configItems.length === 0 && !qrUrl" style="text-align:center;padding:12px;color:#c0c4cc;font-size:13px">
          {{ $t('device.noConfigData') || '暂无配置数据' }}
        </div>
      </template>

      <!-- 二维码地址（来自 tb_device_qr） -->
      <el-form-item v-if="qrUrl" :label="$t('device.qrCode') || '二维码地址'">
        <el-input :model-value="qrUrl" disabled />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">
        {{ $t('common.cancel') || '取消' }}
      </el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ $t('common.save') || '保存' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { updateDevice, getDeviceConfig } from '@/api/devices';
import type { OrgTreeNode } from '@/api/devices';

const props = defineProps<{
  visible: boolean;
  device: any;
  orgTree: OrgTreeNode[];
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
  saved: [];
}>();

const form = ref({
  org_id: null as number | null,
  report_language: 'zh-CN',
});

const saving = ref(false);
const configLoading = ref(false);
const qrUrl = ref('');
const configData = ref<any>(null);

// 展平组织树
interface FlatOrg { id: number; label: string; }
const flatOrgs = computed<FlatOrg[]>(() => {
  function flatten(nodes: OrgTreeNode[], depth: number): FlatOrg[] {
    const result: FlatOrg[] = [];
    for (const n of nodes) {
      const prefix = '  '.repeat(depth);
      result.push({ id: n.id, label: prefix + n.org_name });
      if (n.children?.length) {
        result.push(...flatten(n.children, depth + 1));
      }
    }
    return result;
  }
  return flatten(props.orgTree, 0);
});

// 从配置库 upload_info 中提取指定字段（key 为 i18n key，val 为字段值）
const hwFields = [
  { key: 'mcp_version', i18n: 'device.mcpVersion' },
  { key: 'app_version', i18n: 'device.appVersion' },
  { key: 'res_version', i18n: 'device.resVersion' },
  { key: 'bootloader_version', i18n: 'device.bootloaderVersion' },
];

const configItems = computed<{ label: string; value: string }[]>(() => {
  const raw = configData.value?.upload_info || {};
  const { t } = useI18n();
  return hwFields
    .filter(f => raw[f.key] != null)
    .map(f => ({ label: t(f.i18n), value: String(raw[f.key]) }));
});

function getRootOrgId(): number | null {
  return props.orgTree.length > 0 ? props.orgTree[0].id : null;
}

// 打开弹窗时初始化 + 加载配置库数据
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible && props.device) {
      form.value.org_id = props.device._org_id || getRootOrgId();
      form.value.report_language = props.device._report_language || 'zh-CN';
      // 从 fast_plus 配置库加载硬件配置 + 二维码
      configLoading.value = true;
      configData.value = null;
      qrUrl.value = '';
      try {
        const cfg = await getDeviceConfig(String(props.device.ne_id));
        configData.value = cfg;
        qrUrl.value = cfg?.qr_url || '';
      } catch {
        /* 配置库不可用 */
      } finally {
        configLoading.value = false;
      }
    }
  },
  { immediate: true },
);

async function handleSave() {
  saving.value = true;
  try {
    await updateDevice(props.device.ne_id, {
      org_id: form.value.org_id || undefined,
      report_language: form.value.report_language || undefined,
    });
    ElMessage.success('保存成功');
    emit('saved');
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.qr-thumb {
  max-width: 120px;
  max-height: 120px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}
.config-loading, .config-empty, .config-error {
  padding: 24px;
  text-align: center;
  color: #c0c4cc;
  font-size: 13px;
}
.config-error { color: #f56c6c; }
</style>
