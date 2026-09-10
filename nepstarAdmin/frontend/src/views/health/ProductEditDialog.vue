<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? $t('health.productEdit') : $t('health.productCreate')"
    width="760px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" v-loading="loading">
      <el-form-item :label="$t('health.productName')" prop="name">
        <el-input v-model="form.name" maxlength="100" />
      </el-form-item>
      <el-form-item :label="$t('health.productDesc')">
        <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" />
      </el-form-item>
      <el-form-item :label="$t('health.productImages')" prop="images">
        <ProductImageUploader v-model="form.images" />
      </el-form-item>
      <el-form-item :label="$t('health.productDetail')">
        <div v-if="loaded" class="editor-box">
          <Toolbar :editor="editorRef" :default-config="toolbarConfig" mode="default" />
          <Editor
            v-model="form.detail_html"
            :default-config="editorConfig"
            mode="default"
            style="height: 240px; overflow-y: hidden"
            @on-created="handleCreated"
          />
        </div>
      </el-form-item>
      <el-form-item :label="$t('health.sort')">
        <el-input-number v-model="form.sort_order" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item :label="$t('common.status')">
        <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ $t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { createProduct, fetchProduct, updateProduct, type ProductImage } from '@/api/health'
import ProductImageUploader from './ProductImageUploader.vue'

const props = defineProps<{ visible: boolean; product: any }>()
const emit = defineEmits<{ 'update:visible': [boolean]; saved: [] }>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitting = ref(false)
const loaded = ref(false)

const editorRef = shallowRef<any>()
const toolbarConfig = {}
const editorConfig = { placeholder: '请输入图文详情…' }

function handleCreated(editor: any) {
  editorRef.value = editor
}
onBeforeUnmount(() => editorRef.value?.destroy())

const form = ref({
  name: '',
  description: '',
  detail_html: '',
  sort_order: 0,
  status: 1,
  images: [] as ProductImage[],
})

const isEdit = computed(() => !!props.product?.id)

const rules: FormRules = {
  name: [{ required: true, message: t('health.nameRequired'), trigger: 'blur' }],
  images: [
    {
      validator: (_r: any, _v: any, cb: any) =>
        form.value.images.length ? cb() : cb(new Error(t('health.imageRequired'))),
      trigger: 'change',
    },
  ],
}

function errText(key?: string): string {
  if (!key) return t('health.operationFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.operationFailed') : msg
}

async function load() {
  if (props.product?.id) {
    loading.value = true
    try {
      const r = await fetchProduct(props.product.id)
      const d = r.data
      form.value = {
        name: d.name,
        description: d.description || '',
        detail_html: d.detail_html || '',
        sort_order: d.sort_order ?? 0,
        status: d.status,
        images: d.images || [],
      }
    } catch (e: any) {
      ElMessage.error(errText(e?.message))
    } finally {
      loading.value = false
    }
  } else {
    form.value = { name: '', description: '', detail_html: '', sort_order: 0, status: 1, images: [] }
  }
  loaded.value = true
}

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      loaded.value = false
      await load()
    } else {
      loaded.value = false
    }
  },
)

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      detail_html: form.value.detail_html,
      sort_order: form.value.sort_order,
      status: form.value.status,
      images: form.value.images.map((i, idx) => ({ url: i.url, sort_order: idx })),
    }
    if (isEdit.value) {
      await updateProduct(props.product.id, payload)
      ElMessage.success(t('health.productUpdateSuccess'))
    } else {
      await createProduct(payload)
      ElMessage.success(t('health.productCreateSuccess'))
    }
    emit('saved')
    emit('update:visible', false)
  } catch (e: any) {
    ElMessage.error(errText(e?.message))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.editor-box { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; }
</style>
