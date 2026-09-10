<template>
  <div class="uploader">
    <el-upload
      :show-file-list="false"
      accept="image/*"
      :limit="maxCount"
      :http-request="handleUpload"
      :before-upload="beforeUpload"
    >
      <el-button type="primary" plain>
        <el-icon><Plus /></el-icon>
        {{ $t('health.addImage') }}
      </el-button>
    </el-upload>

    <div v-if="modelValue.length" class="grid">
      <div v-for="(img, idx) in modelValue" :key="img.url" class="item" :class="{ cover: idx === 0 }">
        <img :src="img.url" alt="" class="thumb" />
        <span v-if="idx === 0" class="badge">{{ $t('health.cover') }}</span>
        <div class="actions">
          <el-button text size="small" :disabled="idx === 0" @click="setCover(idx)">
            {{ $t('health.setCover') }}
          </el-button>
          <el-button text size="small" :disabled="idx === 0" @click="move(idx, -1)">↑</el-button>
          <el-button text size="small" :disabled="idx === modelValue.length - 1" @click="move(idx, 1)">↓</el-button>
          <el-button text size="small" type="danger" @click="remove(idx)">{{ $t('common.delete') }}</el-button>
        </div>
      </div>
    </div>
    <div v-else class="empty">{{ $t('health.imageRequired') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { ProductImage } from '@/api/health'
import { PRODUCT_MAX_IMAGE_BYTES, PRODUCT_MAX_IMAGE_COUNT, uploadProductImage } from '@/api/health'

const { t } = useI18n()
const props = defineProps<{ modelValue: ProductImage[] }>()
const emit = defineEmits<{ 'update:modelValue': [ProductImage[]] }>()

const maxCount = PRODUCT_MAX_IMAGE_COUNT


function errText(key?: string): string {
  if (!key) return t('health.uploadFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.uploadFailed') : msg
}

function normalize(list: ProductImage[]): ProductImage[] {
  return list.map((img, i) => ({ ...img, sort_order: i }))
}

function beforeUpload(file: File): boolean {
  if (!file.type.startsWith('image/')) {
    ElMessage.error(t('health.uploadInvalidType'))
    return false
  }
  if (file.size > PRODUCT_MAX_IMAGE_BYTES) {
    ElMessage.error(t('health.uploadTooLarge'))
    return false
  }
  return true
}

async function handleUpload(options: any): Promise<void> {
  const file: File = options.file
  try {
    const r = await uploadProductImage(file)
    const url = r?.data?.url
    if (url) {
      emit('update:modelValue', normalize([...props.modelValue, { url, sort_order: props.modelValue.length }]))
    }
  } catch (e: any) {
    ElMessage.error(errText(e?.message))
  }
}

function remove(idx: number): void {
  emit('update:modelValue', normalize(props.modelValue.filter((_, i) => i !== idx)))
}

function move(idx: number, dir: number): void {
  const list = [...props.modelValue]
  const target = idx + dir
  if (target < 0 || target >= list.length) return
  ;[list[idx], list[target]] = [list[target], list[idx]]
  emit('update:modelValue', normalize(list))
}

function setCover(idx: number): void {
  if (idx === 0) return
  const list = [...props.modelValue]
  const [picked] = list.splice(idx, 1)
  list.unshift(picked)
  emit('update:modelValue', normalize(list))
}
</script>

<style scoped>
.uploader { width: 100%; }
.grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.item { position: relative; width: 116px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
.item.cover { border-color: #3b82f6; }
.thumb { display: block; width: 100%; height: 88px; object-fit: cover; }
.badge { position: absolute; top: 4px; left: 4px; background: #3b82f6; color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 8px; }
.actions { display: flex; flex-wrap: wrap; justify-content: center; padding: 2px 2px 4px; }
.actions :deep(.el-button) { margin: 0; padding: 2px 4px; }
.empty { color: #f56c6c; font-size: 12px; margin-top: 8px; }
</style>
