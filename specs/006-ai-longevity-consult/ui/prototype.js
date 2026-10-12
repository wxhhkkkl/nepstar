// 独立设计预览：所有数据和回答均为本地样例，不调用报告或模型服务。
const content = document.querySelector('#content')
const input = document.querySelector('#question')
const sendButton = document.querySelector('#send-button')
const modal = document.querySelector('#modal')
const toastElement = document.querySelector('#toast')
const newReply = document.querySelector('#new-reply')
const allowedViews = new Set(['welcome', 'chat', 'error', 'loading'])
const samples = {
  overview: {
    title: '可以先了解睡眠这一项。',
    text: '示例报告中的睡眠呼吸为 78 分，上次为 82 分。可以结合近期睡眠感受一起看；分数变化本身不能用于诊断疾病。',
    prompt: '你最近入睡困难，还是醒来后仍感到疲倦？',
    evidence: true,
    followups: ['醒来后仍然疲倦', '先给我一些行动建议'],
  },
  action: {
    title: '可以先从两个容易开始的小行动做起。',
    text: '01  留意自己的睡眠感受\n连续几天记录入睡、起床时间，以及醒来后的精神状态，看看是否有规律。\n\n02  选择一个能坚持的小习惯\n例如给睡前留出一段放松时间。先从容易做到的一件事开始，不必同时改变所有习惯。',
    prompt: '如果不适持续或影响日常生活，建议寻求专业医疗帮助。这些示例建议不能替代评估。',
    evidence: false,
    followups: ['帮我整理一个记录清单', '这个指标具体指什么？'],
  },
  followup: {
    title: '先了解你的实际感受，会更有帮助。',
    text: '醒来后疲倦是你补充的情况，与报告里的分数需要分开看。仅凭这项指标，不能确认疲倦的原因。\n\n这样的情况持续多久了？最近作息有没有明显变化？',
    prompt: '',
    evidence: true,
    followups: ['大约持续了一周', '查看报告依据'],
  },
  generic: {
    title: '问题已收到。',
    text: '当前是交互设计预览，还没有连接真实 AI 服务。这里演示问题发送、回答生成与继续追问的体验。\n\n正式版本会在获得授权后，结合对应报告的数据回答你的问题。',
    prompt: '',
    evidence: false,
    followups: ['哪些指标值得关注？', '我可以从哪里开始改善？'],
  },
}
let currentView = 'welcome'
let generationTimer = null
let generationVersion = 0
let generating = false
let activeResponse = null
let toastTimer = null
let focusBeforeModal = null

function icon(name, className = '') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`
}

function toast(message) {
  clearTimeout(toastTimer)
  toastElement.textContent = message
  toastElement.hidden = false
  toastTimer = setTimeout(() => { toastElement.hidden = true }, 3000)
}

function updateComposer() {
  sendButton.disabled = currentView === 'loading' || (!generating && !input.value.trim())
  input.disabled = currentView === 'loading'
  sendButton.setAttribute('aria-label', generating ? '停止生成' : '发送问题')
  sendButton.innerHTML = generating ? '<span class="stop-square"></span>' : icon('send')
  input.style.height = 'auto'
  input.style.height = `${Math.min(112, Math.max(40, input.scrollHeight))}px`
}

function nearBottom() {
  return content.scrollHeight - content.scrollTop - content.clientHeight < 85
}

function goToBottom() {
  content.scrollTop = content.scrollHeight
  newReply.hidden = true
}

function appendUser(text) {
  const node = document.createElement('div')
  node.className = 'user-message'
  node.textContent = text
  content.append(node)
}

function addDate() {
  const date = document.createElement('div')
  date.className = 'chat-date'
  date.textContent = '今天 · 09:41'
  content.append(date)
}

function createResponse(sample, waiting = false) {
  const container = document.createElement('section')
  container.className = 'assistant-message'
  container.innerHTML = `<div class="assistant-heading"><span>${icon('spark')}</span><b>AI 长寿顾问</b><small>AI</small></div><div class="answer-card"><div class="typing" ${waiting ? '' : 'hidden'}><i></i><i></i><i></i><span>正在整理示例回答…</span></div><h3></h3><p class="answer-text"></p><p class="answer-prompt" hidden></p><div class="answer-extra"></div></div><div class="follow-ups"></div>`
  const title = container.querySelector('h3')
  const text = container.querySelector('.answer-text')
  if (waiting) title.hidden = true
  else {
    title.textContent = sample.title
    text.textContent = sample.text
    completeResponse(container, sample)
  }
  content.append(container)
  return container
}

function completeResponse(container, sample) {
  const prompt = container.querySelector('.answer-prompt')
  prompt.textContent = sample.prompt
  prompt.hidden = !sample.prompt
  const extra = container.querySelector('.answer-extra')
  extra.innerHTML = sample.evidence ? `<details class="evidence"><summary>${icon('report')}参考了 2 条报告依据${icon('down')}</summary><div class="evidence-rows"><div class="evidence-row"><span>睡眠呼吸 · 2026.10.08</span><strong>78</strong></div><div class="evidence-row"><span>睡眠呼吸 · 2026.09.12</span><strong>82</strong></div><small>设计样例，不代表真实检测结果</small></div></details>` : ''
  extra.insertAdjacentHTML('beforeend', `<div class="answer-actions"><button data-action="copy" aria-label="复制回答">${icon('copy')}</button><button data-action="helpful" aria-label="有帮助" aria-pressed="false">${icon('like')}</button><button class="feedback-down" data-action="unhelpful" aria-label="没有帮助" aria-pressed="false">${icon('like')}</button><span class="answer-time">示例回答</span></div>`)
  const follows = container.querySelector('.follow-ups')
  follows.replaceChildren()
  for (const label of sample.followups) {
    const button = document.createElement('button')
    button.dataset.question = label
    button.innerHTML = icon('plus')
    const span = document.createElement('span')
    span.textContent = label
    button.append(span)
    follows.append(button)
  }
}

function cancelGeneration(markPartial = true) {
  generationVersion += 1
  clearTimeout(generationTimer)
  if (generating && activeResponse && markPartial) {
    activeResponse.querySelector('.typing').hidden = true
    const note = document.createElement('p')
    note.className = 'partial-note'
    note.textContent = '已停止 · 回答未完成'
    activeResponse.querySelector('.answer-extra').append(note)
    const retry = document.createElement('button')
    retry.textContent = '重新生成'
    retry.dataset.action = 'regenerate'
    activeResponse.querySelector('.follow-ups').append(retry)
  }
  generating = false
  updateComposer()
}

function showView(view, updateUrl = true) {
  cancelGeneration(false)
  closeSheet()
  currentView = allowedViews.has(view) ? view : 'welcome'
  input.value = ''
  content.replaceChildren()
  newReply.hidden = true
  if (currentView === 'chat') {
    addDate()
    appendUser('这份报告有哪些指标值得关注？')
    createResponse(samples.overview)
  } else {
    content.append(document.querySelector(`#${currentView}-template`).content.cloneNode(true))
  }
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === currentView
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  if (updateUrl) {
    const url = new URL(location.href)
    url.searchParams.set('view', currentView)
    history.replaceState(null, '', url)
  }
  content.scrollTop = 0
  updateComposer()
}

function selectSample(question) {
  if (/改善|行动|记录清单/.test(question)) return samples.action
  if (/疲倦|一周/.test(question)) return samples.followup
  if (/报告|指标|依据/.test(question)) return samples.overview
  return samples.generic
}

function generateAnswer(question) {
  cancelGeneration(false)
  const sample = selectSample(question)
  const response = createResponse(sample, true)
  activeResponse = response
  generating = true
  updateComposer()
  goToBottom()
  const version = generationVersion
  let length = 0
  const text = response.querySelector('.answer-text')
  function tick() {
    if (version !== generationVersion) return
    const follow = nearBottom()
    response.querySelector('.typing').hidden = true
    const heading = response.querySelector('h3')
    heading.hidden = false
    heading.textContent = sample.title
    length += 4
    text.textContent = sample.text.slice(0, length)
    if (length >= sample.text.length) {
      completeResponse(response, sample)
      generating = false
      updateComposer()
    } else generationTimer = setTimeout(tick, 40)
    if (follow) goToBottom()
    else newReply.hidden = false
  }
  generationTimer = setTimeout(tick, 900)
}

function ask(question) {
  if (generating || currentView === 'loading') return
  if (currentView !== 'chat') {
    showView('chat')
    content.replaceChildren()
    addDate()
  }
  appendUser(question)
  input.value = ''
  input.blur()
  updateComposer()
  generateAnswer(question)
}

function openSheet(title, html) {
  focusBeforeModal = document.activeElement
  document.querySelector('#sheet-title').textContent = title
  document.querySelector('#sheet-body').innerHTML = html
  modal.hidden = false
  document.querySelector('#app').querySelectorAll(':scope > :not(.modal-backdrop):not(.toast)').forEach(node => { node.inert = true })
  modal.querySelector('[data-action="close"]').focus()
}

function closeSheet() {
  modal.hidden = true
  document.querySelector('#app').querySelectorAll(':scope > [inert]').forEach(node => { node.inert = false })
  if (focusBeforeModal?.isConnected) focusBeforeModal.focus({ preventScroll: true })
  focusBeforeModal = null
}

function showConsent() {
  openSheet('开始前，了解一下', `<p class="sheet-copy">让 AI 更懂你的报告，也让你知道自己的信息如何被使用。</p><div class="privacy-item">${icon('report')}<div><strong>只结合必要的报告信息</strong><p>咨询时，会将相关指标和你的问题提供给 AI 服务，用于生成回答。</p></div></div><div class="privacy-item">${icon('shield')}<div><strong>后台永久保存咨询内容</strong><p>完整问题和回答会与本次报告关联保存在后台，不设自动清理；再次进入会开启新咨询，且不能查看之前的咨询。</p></div></div><div class="privacy-item">${icon('spark')}<div><strong>帮助理解，不替代医疗判断</strong><p>AI 回答用于健康管理参考。如果身体不适，请及时寻求专业帮助。</p></div></div><p class="consent-note">这是交互设计预览，不会发送健康信息。正式上线前会展示实际 AI 服务商和完整数据处理范围。</p><button class="primary-button" data-action="accept">了解，开始体验</button><button class="secondary-button" data-action="close">暂不开始</button>`)
}

document.querySelector('#composer').addEventListener('submit', event => {
  event.preventDefault()
  if (generating) return cancelGeneration()
  const question = input.value.trim()
  if (question) ask(question)
})
input.addEventListener('input', updateComposer)
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    document.querySelector('#composer').requestSubmit()
  }
})
content.addEventListener('scroll', () => { if (nearBottom()) newReply.hidden = true })
newReply.addEventListener('click', goToBottom)
modal.addEventListener('click', event => { if (event.target === modal) closeSheet() })
document.addEventListener('keydown', event => {
  if (modal.hidden) return
  if (event.key === 'Escape') closeSheet()
  if (event.key === 'Tab') {
    const focusables = [...modal.querySelectorAll('button, a[href], input, textarea')].filter(node => !node.disabled)
    const first = focusables[0]
    const last = focusables.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
})
document.addEventListener('click', async event => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.view) return showView(target.dataset.view)
  if (target.dataset.question) return ask(target.dataset.question)
  switch (target.dataset.action) {
    case 'back':
      if (currentView !== 'welcome') showView('welcome')
      else toast('正式页面将返回你进入咨询前的报告位置')
      break
    case 'consent': showConsent(); break
    case 'close': closeSheet(); break
    case 'accept': closeSheet(); toast('仅开始设计体验，不调用真实 AI 服务'); break
    case 'report':
      openSheet('本次报告 · 示例', '<p class="sheet-copy">回答会结合当前报告中的相关信息。你可以随时回看引用的依据。</p><div class="report-fact"><span>检测日期</span><strong>2026.10.08</strong></div><div class="report-fact"><span>睡眠呼吸</span><strong>78 分</strong></div><div class="report-fact"><span>上次记录 · 2026.09.12</span><strong>82 分</strong></div><p class="sheet-body-note">以上仅为界面演示数据，不对应任何真实客户。</p><button class="primary-button" data-action="close">继续咨询</button>')
      break
    case 'retry':
      showView('chat')
      content.querySelector('.assistant-message').remove()
      generateAnswer('哪些指标值得关注？')
      break
    case 'regenerate': {
      const response = target.closest('.assistant-message')
      const question = response.previousElementSibling?.textContent || '哪些指标值得关注？'
      response.remove()
      generateAnswer(question)
      break
    }
    case 'copy': {
      const response = target.closest('.assistant-message')
      const text = ['h3', '.answer-text', '.answer-prompt'].map(selector => response.querySelector(selector).textContent).filter(Boolean).join('\n\n')
      try { await navigator.clipboard.writeText(text); toast('回答已复制') }
      catch { toast('浏览器未允许复制，请长按文字选择') }
      break
    }
    case 'helpful':
    case 'unhelpful': {
      const selected = target.getAttribute('aria-pressed') !== 'true'
      target.closest('.answer-actions').querySelectorAll('[aria-pressed]').forEach(button => button.setAttribute('aria-pressed', 'false'))
      target.setAttribute('aria-pressed', String(selected))
      if (selected) toast('已标记反馈（设计演示）')
      break
    }
  }
})

function resizeViewport() {
  document.documentElement.style.setProperty('--visible-height', `${window.visualViewport?.height || window.innerHeight}px`)
}
window.visualViewport?.addEventListener('resize', resizeViewport)
window.addEventListener('resize', resizeViewport)
const initialView = new URLSearchParams(location.search).get('view') || 'welcome'
showView(initialView === 'consent' ? 'welcome' : initialView, false)
resizeViewport()
if (initialView === 'consent') showConsent()
