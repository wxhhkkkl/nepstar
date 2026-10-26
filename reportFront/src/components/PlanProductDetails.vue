<script setup>
import { computed, ref } from 'vue'
import backIcon from '@/assets/report-back.svg'

const props = defineProps({ product: { type: Object, required: true }, expanded: Boolean, imageIndex: { type: Number, default: 0 } })
const emit = defineEmits(['update:expanded', 'update:imageIndex'])
const failedImages = ref(new Set())
const images = computed(() => props.product.images || [])
const index = computed(() => Math.max(0, Math.min(images.value.length - 1, Number(props.imageIndex) || 0)))
const image = computed(() => images.value[index.value])
const hasBody = computed(() => Boolean(props.product.detail_blocks?.length))
function switchImage(delta) {
  emit('update:imageIndex', (index.value + delta + images.value.length) % images.value.length)
}
</script>

<template>
  <article class="plan-product" :data-product-id="product.product_id">
    <div class="product-overview">
      <div class="product-visual">
        <img referrerpolicy="no-referrer" v-if="image && !failedImages.has(image.url)" :src="image.url" :alt="image.alt || product.name" @error="failedImages.add(image.url)">
        <span v-else class="product-missing">暂无图片</span>
        <div v-if="images.length > 1" class="product-image-controls">
          <button type="button" aria-label="上一张产品图片" @click="switchImage(-1)"><img referrerpolicy="no-referrer" :src="backIcon" alt=""></button>
          <span data-testid="product-images-position" aria-live="polite">{{ index + 1 }}/{{ images.length }}</span>
          <button type="button" aria-label="下一张产品图片" @click="switchImage(1)"><img referrerpolicy="no-referrer" :src="backIcon" alt=""></button>
        </div>
      </div>
      <div class="product-copy"><h3>{{ product.name }}</h3><p v-if="product.description">{{ product.description }}</p></div>
      <button v-if="hasBody" type="button" class="product-toggle" :aria-expanded="expanded" :aria-controls="`product-body-${product.product_id}`" :aria-label="`${expanded ? '收起' : '展开'}${product.name}说明`" @click="emit('update:expanded', !expanded)"><img referrerpolicy="no-referrer" :src="backIcon" alt="" :class="{ expanded }"></button>
    </div>
    <Transition name="product-expand">
      <div v-if="hasBody && expanded" :id="`product-body-${product.product_id}`" role="region" :aria-label="`${product.name}详细说明`" class="product-body">
        <template v-for="(block, blockIndex) in product.detail_blocks" :key="blockIndex">
          <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
          <component :is="block.level === 2 ? 'h3' : 'h4'" v-else-if="block.type === 'heading'">{{ block.text }}</component>
          <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'"><li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li></component>
          <template v-else-if="block.type === 'image'"><img referrerpolicy="no-referrer" v-if="!failedImages.has(block.url)" :src="block.url" :alt="block.alt" loading="lazy" @error="failedImages.add(block.url)"><p v-else class="product-body-image-missing">图片暂不可用。</p></template>
        </template>
        <p v-if="product.detail_truncated" class="product-truncated">内容较长，仅展示部分说明。</p>
      </div>
    </Transition>
  </article>
</template>

<style scoped>
.plan-product{background:#f1f6fc;border-radius:12px;margin-bottom:12px;overflow:hidden}.product-overview{display:flex;align-items:center;gap:14px;padding:12px}.product-visual{width:80px;flex-shrink:0;align-self:start}.product-visual>img,.product-missing{width:80px;height:96px;object-fit:contain}.product-missing{display:grid;place-items:center;font-size:13px;color:#7c8aa1}.product-copy{flex:1;min-width:0}.product-copy h3{font-size:16px;line-height:1.6;color:#173356;margin:0 0 8px;font-weight:700;overflow-wrap:anywhere}.product-copy p{font-size:15px;line-height:1.8;color:#6e8099;margin:0;overflow-wrap:anywhere;white-space:pre-line}.product-toggle{flex-shrink:0;width:44px;height:44px;margin-right:-10px;border:0;background:transparent;padding:12px;cursor:pointer}.product-toggle img{width:18px;height:18px;transform:rotate(180deg);transition:transform .24s}.product-toggle img.expanded{transform:rotate(270deg)}.product-image-controls{display:flex;align-items:center;justify-content:center;font-size:13px;color:#6e8099;margin-top:3px}.product-image-controls button{border:0;background:transparent;min-width:44px;min-height:44px;padding:13px;cursor:pointer}.product-image-controls img{width:14px;height:14px}.product-image-controls button:last-child img{transform:rotate(180deg)}.product-image-controls span{position:absolute;pointer-events:none}.product-body{padding:4px 16px 16px;border-top:1px solid #e0e9f5;overflow-wrap:anywhere;color:#6e8099;font-size:15px;line-height:1.9}.product-body p{white-space:pre-line;margin:14px 0}.product-body h3,.product-body h4{font-size:16px;color:#173356;margin:18px 0 10px}.product-body img{max-width:100%;height:auto;display:block;margin:14px auto}.product-body-image-missing{min-height:96px;display:grid;place-items:center;font-size:13px}.product-body ul,.product-body ol{padding-left:22px}.product-truncated{font-size:13px}.product-expand-enter-active,.product-expand-leave-active{transition:opacity .24s,transform .24s}.product-expand-enter-from,.product-expand-leave-to{opacity:0;transform:translateY(-5px)}button:focus-visible{outline:2px solid #325fc6;outline-offset:-3px}@media(prefers-reduced-motion:reduce){.product-toggle img,.product-expand-enter-active,.product-expand-leave-active{transition:none}}
</style>
