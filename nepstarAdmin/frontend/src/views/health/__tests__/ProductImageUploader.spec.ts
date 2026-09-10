// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { createI18n } from 'vue-i18n';
import zhCN from '@/i18n/zh-CN.json';
import type { ProductImage } from '@/api/health';

vi.mock('@/api/health', () => ({
  PRODUCT_MAX_IMAGE_COUNT: 10,
  PRODUCT_MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  uploadProductImage: vi.fn(),
}));

import ProductImageUploader from '../ProductImageUploader.vue';

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } });

function images(): ProductImage[] {
  return [
    { url: 'https://x/a.jpg', sort_order: 0 },
    { url: 'https://x/b.jpg', sort_order: 1 },
    { url: 'https://x/c.jpg', sort_order: 2 },
  ];
}

function mountUploader(modelValue: ProductImage[]) {
  return mount(ProductImageUploader, {
    props: { modelValue },
    global: { plugins: [ElementPlus, i18n] },
  });
}

function lastEmitted(wrapper: any): ProductImage[] {
  const events = wrapper.emitted('update:modelValue');
  return events[events.length - 1][0] as ProductImage[];
}

describe('ProductImageUploader', () => {
  it('renders a thumbnail per image and marks the first as cover', () => {
    const wrapper = mountUploader(images());
    expect(wrapper.findAll('.item')).toHaveLength(3);
    expect(wrapper.find('.item.cover').exists()).toBe(true);
    expect(wrapper.text()).toContain('封面');
  });

  it('removes an image and renumbers sort_order', async () => {
    const wrapper = mountUploader(images());
    // operation buttons of the 2nd item: setCover/up/down/delete
    const rows = wrapper.findAll('.item');
    const deleteBtn = rows[1].findAll('button').find((b) => b.text().includes('删除'));
    await deleteBtn!.trigger('click');
    const out = lastEmitted(wrapper);
    expect(out.map((i) => i.url)).toEqual(['https://x/a.jpg', 'https://x/c.jpg']);
    expect(out.map((i) => i.sort_order)).toEqual([0, 1]);
  });

  it('moves an image down (order changes, cover stays first)', async () => {
    const wrapper = mountUploader(images());
    const rows = wrapper.findAll('.item');
    const downBtn = rows[0].findAll('button').find((b) => b.text() === '↓');
    await downBtn!.trigger('click');
    const out = lastEmitted(wrapper);
    expect(out.map((i) => i.url)).toEqual(['https://x/b.jpg', 'https://x/a.jpg', 'https://x/c.jpg']);
    expect(out[0].sort_order).toBe(0);
  });

  it('sets a non-first image as cover via its action', async () => {
    const wrapper = mountUploader(images());
    const rows = wrapper.findAll('.item');
    const coverBtn = rows[2].findAll('button').find((b) => b.text().includes('设为封面'));
    await coverBtn!.trigger('click');
    const out = lastEmitted(wrapper);
    expect(out[0].url).toBe('https://x/c.jpg');
    expect(out.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it('shows the required hint when no image is present', () => {
    const wrapper = mountUploader([]);
    expect(wrapper.findAll('.item')).toHaveLength(0);
    expect(wrapper.text()).toContain('至少上传一张图片');
  });
});
