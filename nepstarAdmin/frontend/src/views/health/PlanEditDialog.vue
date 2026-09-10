<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? $t('health.planEdit') : $t('health.planCreate')"
    width="820px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" v-loading="loading">
      <el-form-item :label="$t('health.planName')" prop="name">
        <el-input v-model="form.name" maxlength="100" />
      </el-form-item>
      <el-form-item :label="$t('health.planDesc')">
        <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" />
      </el-form-item>

      <el-form-item :label="$t('health.planProducts')">
        <div class="picker-box">
          <el-select
            :model-value="productIds"
            multiple
            filterable
            :placeholder="$t('health.selectProducts')"
            style="width: 100%"
            @update:model-value="setProductIds"
          >
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <div v-if="productIds.length" class="ordered">
            <div v-for="(pid, idx) in productIds" :key="pid" class="ordered-row">
              <span class="idx">{{ idx + 1 }}</span>
              <span class="name">{{ productName(pid) }}</span>
              <span class="ops">
                <el-button text size="small" :disabled="idx === 0" @click="moveProduct(idx, -1)">↑</el-button>
                <el-button text size="small" :disabled="idx === productIds.length - 1" @click="moveProduct(idx, 1)">↓</el-button>
                <el-button text size="small" type="danger" @click="removeProduct(idx)">{{ $t('common.delete') }}</el-button>
              </span>
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="$t('health.planIndicators')">
        <div class="tree-box">
          <p class="tree-hint">{{ $t('health.strictHint') }}</p>
          <el-tree
            ref="treeRef"
            :data="indicatorTree"
            node-key="id"
            show-checkbox
            check-strictly
            default-expand-all
            :expand-on-click-node="false"
            :props="{ children: 'children', label: 'name' }"
          >
            <template #default="{ data }">
              <span>
                {{ data.name }}
                <span class="code">({{ data.code }})</span>
                <el-tag v-if="data.status === 0" size="small" type="info" class="off">{{ $t('common.disabled') }}</el-tag>
              </span>
            </template>
          </el-tree>
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules, type TreeInstance } from 'element-plus'
import {
  createPlan,
  fetchIndicatorTree,
  fetchPlan,
  fetchProducts,
  updatePlan,
  type IndicatorNode,
  type ProductListItem,
} from '@/api/health'

const props = defineProps<{ visible: boolean; plan: any }>()
const emit = defineEmits<{ 'update:visible': [boolean]; saved: [] }>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const treeRef = ref<TreeInstance>()
const loading = ref(false)
const submitting = ref(false)

const products = ref<ProductListItem[]>([])
const indicatorTree = ref<IndicatorNode[]>([])

const form = ref({ name: '', description: '', sort_order: 0, status: 1 })
const productIds = ref<number[]>([])
const indicatorIds = ref<number[]>([])

const isEdit = computed(() => !!props.plan?.id)

const rules: FormRules = {
  name: [{ required: true, message: t('health.nameRequired'), trigger: 'blur' }],
}

function productName(id: number): string {
  return products.value.find((p) => p.id === id)?.name || String(id)
}

function dedup(ids: number[]): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

function errText(key?: string): string {
  if (!key) return t('health.operationFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.operationFailed') : msg
}

// ---- exposed-for-test helpers (also used by the template) ----
function setProductIds(ids: number[] | undefined) {
  productIds.value = dedup(ids || [])
}

function removeProduct(idx: number) {
  productIds.value = productIds.value.filter((_, i) => i !== idx)
}

function moveProduct(idx: number, dir: number) {
  const list = [...productIds.value]
  const target = idx + dir
  if (target < 0 || target >= list.length) return
  ;[list[idx], list[target]] = [list[target], list[idx]]
  productIds.value = list
}

function syncIndicatorsFromKeys(keys: (string | number)[]) {
  indicatorIds.value = dedup(keys.map((k) => Number(k)))
}

function buildPayload() {
  return {
    name: form.value.name,
    description: form.value.description,
    sort_order: form.value.sort_order,
    status: form.value.status,
    product_ids: [...productIds.value],
    indicator_ids: [...indicatorIds.value],
  }
}

async function load() {
  const [prodRes, treeRes] = await Promise.all([fetchProducts({ page: 1, page_size: 200 }), fetchIndicatorTree({})])
  products.value = prodRes.data?.records || []
  indicatorTree.value = treeRes.data || []

  if (props.plan?.id) {
    loading.value = true
    try {
      const r = await fetchPlan(props.plan.id)
      const d = r.data
      form.value = {
        name: d.name,
        description: d.description || '',
        sort_order: d.sort_order ?? 0,
        status: d.status,
      }
      productIds.value = dedup((d.products || []).map((p: any) => p.product_id))
      indicatorIds.value = dedup((d.indicators || []).map((i: any) => i.indicator_id))
      setTimeout(() => treeRef.value?.setCheckedKeys(indicatorIds.value), 0)
    } catch (e: any) {
      ElMessage.error(errText(e?.message))
    } finally {
      loading.value = false
    }
  } else {
    form.value = { name: '', description: '', sort_order: 0, status: 1 }
    productIds.value = []
    indicatorIds.value = []
  }
}

watch(
  () => props.visible,
  async (v) => {
    if (v) await load()
  },
  { immediate: true },
)

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  // strict-precise: take exactly the checked nodes (check-strictly => no parent auto-check)
  const checked = (treeRef.value?.getCheckedKeys() || []) as number[]
  syncIndicatorsFromKeys(checked)
  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await updatePlan(props.plan.id, payload)
      ElMessage.success(t('health.planUpdateSuccess'))
    } else {
      await createPlan(payload)
      ElMessage.success(t('health.planCreateSuccess'))
    }
    emit('saved')
    emit('update:visible', false)
  } catch (e: any) {
    ElMessage.error(errText(e?.message))
  } finally {
    submitting.value = false
  }
}

defineExpose({ form, productIds, indicatorIds, setProductIds, removeProduct, moveProduct, syncIndicatorsFromKeys, buildPayload })
</script>

<style scoped>
.picker-box { width: 100%; }
.ordered { margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 8px; }
.ordered-row { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
.idx { width: 20px; color: #94a3b8; font-size: 12px; }
.name { flex: 1; }
.tree-box { max-height: 30vh; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; width: 100%; box-sizing: border-box; }
.tree-hint { color: #94a3b8; font-size: 12px; margin: 0 0 6px 4px; }
.code { color: #94a3b8; font-size: 12px; }
.off { margin-left: 6px; }
</style>
