import { it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanProductDetails from '@/components/PlanProductDetails.vue'
import { planDetail } from '../fixtures/planDetail.js'

it('keeps real basic information without an empty expand control', () => {
  const wrapper = mount(PlanProductDetails, { props: { product: planDetail.products[0] } })
  expect(wrapper.text()).toContain(planDetail.products[0].name)
  expect(wrapper.find('[aria-expanded]').exists()).toBe(false)
  expect(wrapper.find('[data-testid="product-images-position"]').exists()).toBe(false)
  expect(wrapper.get('.product-visual > img').attributes('referrerpolicy')).toBe('no-referrer')
})
it('expands individual safe blocks and exposes accessible image switching', async () => {
  const product = { ...planDetail.products[0], images: [{ url: '/a.png', alt: 'A' }, { url: '/b.png', alt: 'B' }],
    detail_blocks: [{ type: 'paragraph', text: '<script>plain text</script>' }, { type: 'image', url: '/body.png', alt: '原图' }], detail_truncated: true }
  const wrapper = mount(PlanProductDetails, { props: { product } })
  await wrapper.get('[aria-expanded]').trigger('click')
  expect(wrapper.emitted('update:expanded')[0]).toEqual([true])
  await wrapper.setProps({ expanded: true })
  expect(wrapper.get('[role="region"]').text()).toContain('<script>plain text</script>')
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.text()).toContain('仅展示部分说明')
  await wrapper.get('[aria-label="下一张产品图片"]').trigger('click')
  expect(wrapper.emitted('update:imageIndex')[0]).toEqual([1])
})
