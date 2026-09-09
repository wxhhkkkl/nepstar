<template>
  <div class="org-tree-panel">
    <div class="panel-header">
      <el-icon class="header-icon"><Folder /></el-icon>
      <span>{{ title }}</span>
    </div>
    <div class="panel-body">
      <el-tree
        ref="treeRef"
        :data="orgTree"
        node-key="id"
        :props="treeProps"
        :highlight-current="!showCheckbox"
        :show-checkbox="showCheckbox"
        :check-strictly="showCheckbox"
        :default-expand-all="defaultExpandAll"
        :expand-on-click-node="false"
        :filter-node-method="filterNode"
        @node-click="onNodeClick"
        @check="onCheck"
      >
        <template #default="{ data }">
          <span class="tree-node">
            <el-icon class="node-icon"><FolderOpened v-if="data.children?.length" /><Document v-else /></el-icon>
            <span class="node-label">{{ data.org_name }}</span>
            <span v-if="data.children?.length" class="node-count">{{ data.children.length }}</span>
          </span>
        </template>
      </el-tree>
      <div v-if="orgTree.length === 0" class="empty-state">
        <el-icon class="empty-icon"><FolderDelete /></el-icon>
        <p>{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Document, Folder, FolderDelete, FolderOpened } from '@element-plus/icons-vue';
import type { TreeInstance } from 'element-plus';

export interface OrgTreeNode {
  id: number;
  org_name: string;
  org_code: string;
  children: OrgTreeNode[];
}

const props = withDefaults(defineProps<{
  orgTree: OrgTreeNode[];
  showCheckbox?: boolean;
  checkedKeys?: number[];
  defaultExpandAll?: boolean;
  title?: string;
  emptyText?: string;
}>(), {
  showCheckbox: false,
  checkedKeys: () => [],
  defaultExpandAll: true,
  title: '组织结构',
  emptyText: '暂无可用组织',
});

const emit = defineEmits<{
  'node-click': [node: OrgTreeNode];
  'update:checkedKeys': [keys: number[]];
}>();

const treeRef = ref<TreeInstance>();
const treeProps = { children: 'children', label: 'org_name' };

function getDescendantKeys(node: any): number[] {
  const keys: number[] = [];
  if (node.children?.length) {
    for (const child of node.children) {
      keys.push(child.id);
      keys.push(...getDescendantKeys(child));
    }
  }
  return keys;
}

function onNodeClick(data: OrgTreeNode) {
  emit('node-click', data);
}

function onCheck(data: any) {
  const tree = treeRef.value;
  if (!tree) return;

  const descendantKeys = getDescendantKeys(data);
  if (descendantKeys.length === 0) return;

  const currentChecked = tree.getCheckedKeys() as number[];
  const isChecking = currentChecked.includes(data.id);

  if (isChecking) {
    tree.setCheckedKeys([...new Set([...currentChecked, ...descendantKeys])]);
  } else {
    tree.setCheckedKeys(currentChecked.filter(k => !descendantKeys.includes(k)));
  }

  emit('update:checkedKeys', tree.getCheckedKeys() as number[]);
}

function filterNode(_value: string, _data: any): boolean {
  return true;
}

function setCheckedKeys(keys: number[]) {
  treeRef.value?.setCheckedKeys(keys);
}

defineExpose({ setCheckedKeys });
</script>

<style scoped>
.org-tree-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  border-right: 1px solid #e8ecf1;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  background: #fff;
  border-bottom: 1px solid #e8ecf1;
}
.header-icon {
  color: #029ba0;
  font-size: 16px;
}

.panel-body {
  flex: 1;
  overflow: auto;
  padding: 6px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  width: 100%;
}
.node-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #94a3b8;
}
.node-label {
  flex: 1;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-count {
  flex-shrink: 0;
  font-size: 11px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 10px;
  margin-right: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: #94a3b8;
  font-size: 13px;
}
.empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

/* Element Plus tree overrides */
::deep(.el-tree) {
  background: transparent;
}
::deep(.el-tree-node__content) {
  height: 40px;
  padding: 0 12px;
  margin: 2px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}
::deep(.el-tree-node__content:hover) {
  background: #e0f4f4;
}
::deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #d6f0f1;
  color: #026066;
}
::deep(.el-tree-node.is-current > .el-tree-node__content .node-label) {
  color: #026066;
  font-weight: 500;
}
::deep(.el-tree-node__expand-icon) {
  color: #94a3b8;
  font-size: 12px;
}
::deep(.el-tree-node__expand-icon:hover) {
  color: #029ba0;
}
</style>
