<template>
  <div class="page">
    <h2 class="page-title">{{ $t('menu.menuMgmt') }}</h2>
    <div class="card">
      <p class="note">{{ $t('menu.readonlyNote') }}</p>
      <el-tree
        :data="tree"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
      >
        <template #default="{ data }">
          <div
            class="tree-node"
            :class="{ 'is-leaf': !data.children?.length, 'is-root': data.parent_id === null }"
          >
            <el-icon class="node-icon" :size="18">
              <Grid v-if="data.parent_id === null" />
              <Menu v-else-if="data.children?.length" />
              <Link v-else />
            </el-icon>

            <div class="node-body">
              <div class="node-main">
                <span class="node-name">{{ menuName(data) }}</span>
                <el-tag size="small" :type="data.status === 1 ? 'success' : 'info'" effect="plain">
                  {{ data.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
                </el-tag>
                <span v-if="data.route_path" class="route-path">{{ data.route_path }}</span>
                <span v-if="data.children?.length" class="child-count">
                  {{ data.children.length }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Grid, Menu, Link } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'

const appStore = useAppStore()
const tree = ref<any[]>([])

function menuName(m: any) {
  const l = appStore.language
  return l === 'en' ? m.name_en : l === 'es' ? m.name_es : m.name_zh
}

async function fetchTree() {
  const r = await api.get('/menus')
  tree.value = r.data
}

onMounted(fetchTree)
</script>

<style scoped>
.page { max-width: 1400px; }
.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
}

/* ── Card ── */
.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
}
.note {
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

/* ── Tree container ── */
:deep(.el-tree) {
  background: transparent;
}

/* ── Tree node row ── */
:deep(.el-tree-node__content) {
  height: auto;
  padding: 6px 8px;
  margin: 2px 0;
  border-radius: 8px;
  transition: background .18s ease;
}
:deep(.el-tree-node__content:hover) {
  background: #f8fafc;
}

/* ── Expand icon ── */
:deep(.el-tree-node__expand-icon) {
  color: #94a3b8;
  transition: transform .2s ease, color .18s;
}
:deep(.el-tree-node__expand-icon:hover) {
  color: #3b82f6;
}
:deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
  cursor: default;
}

/* ── Indent guide lines ── */
:deep(.el-tree-node) {
  position: relative;
}
:deep(.el-tree-node > .el-tree-node__children) {
  position: relative;
}
:deep(.el-tree-node > .el-tree-node__children::before) {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 18px;
  width: 1px;
  background: linear-gradient(to bottom, #e2e8f0 60%, transparent);
}

/* ── Node card ── */
.tree-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  flex: 1;
  min-width: 0;
}

/* ── Node icon ── */
.node-icon {
  flex-shrink: 0;
  color: #94a3b8;
  transition: color .18s;
}
.tree-node.is-root .node-icon {
  color: #3b82f6;
}
.tree-node:not(.is-leaf) .node-icon {
  color: #6366f1;
}

/* ── Node body ── */
.node-body {
  flex: 1;
  min-width: 0;
}
.node-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.node-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
}
.tree-node.is-root .node-name {
  font-weight: 600;
  color: #0f172a;
}

/* ── Route path ── */
.route-path {
  font-size: 12px;
  color: #94a3b8;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

/* ── Child-count badge ── */
.child-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}
</style>
