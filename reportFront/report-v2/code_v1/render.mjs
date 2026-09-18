import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "zh-CN" });

async function shot(file, suffix, output, wait = 1900) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${pathToFileURL(path.join(here, file)).href}${suffix}`, { waitUntil: "load" });
  await page.waitForTimeout(wait);
  if (file === "index.html") {
    const cards = page.locator(".systems-section .data-card");
    for (let index = 0; index < await cards.count(); index++) {
      await cards.nth(index).scrollIntoViewIfNeeded();
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(950);
    await page.evaluate(() => {
      document.querySelectorAll(".systems-section .data-card").forEach(card => card.classList.add("is-visible"));
      scrollTo(0, 0);
    });
  }
  await page.screenshot({ path: path.join(here, output), fullPage: true });
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  console.log(JSON.stringify({ output, size, errors }));
  await page.close();
}

await shot("index.html", "", "长寿指数报告V2_手机长图.png");
await shot("detail.html", "?id=immune", "长寿指数报告V2_免疫力详情页.png", 200);

const test = await context.newPage();
await test.goto(pathToFileURL(path.join(here, "index.html")).href, { waitUntil: "load" });
await test.waitForTimeout(1700);
const score = await test.locator("#scoreValue").textContent();
const homeTopNav = await test.locator(".report-v2 > .top-nav").count();
const saveButton = test.locator("#saveReport");
const saveMeta = { href: await saveButton.getAttribute("href"), download: await saveButton.getAttribute("download") };
const saveFeedback = await saveButton.evaluate(el => {
  const href = el.getAttribute("href");
  el.removeAttribute("href");
  el.click();
  const result = { label: el.querySelector("span")?.textContent, saved: el.classList.contains("is-saved"), toast: document.querySelector("#saveToast")?.classList.contains("is-showing") };
  if (href) el.setAttribute("href", href);
  return result;
});
const links = await test.locator(".systems-section a.data-card").count();
const productRecommendation = test.locator(".product-recommendation");
const productMeta = {
  count: await productRecommendation.count(),
  title: await productRecommendation.locator("h2").textContent(),
  imageLoaded: await productRecommendation.locator("img").evaluate(image => image.complete && image.naturalWidth > 0),
  actionHref: await productRecommendation.locator("a.product-rec-action").getAttribute("href"),
  disclaimer: await productRecommendation.locator(".product-rec-disclaimer").textContent()
};
const seniorType = await test.evaluate(() => {
  const size = selector => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
  return {
    introBody: size(".editorial-intro p"),
    quickLabel: size(".quick-card > span"),
    cardBody: size(".cardio-card p"),
    chartLabel: size(".stat-row small"),
    productBody: size(".product-rec-copy p"),
    productDisclaimer: size(".product-rec-disclaimer")
  };
});
const aiEntry = test.locator("a.ai-consult-entry");
const aiEntryMeta = {
  count: await aiEntry.count(),
  href: await aiEntry.getAttribute("href"),
  label: await aiEntry.locator("strong").textContent(),
  imageLoaded: await aiEntry.locator("img").evaluate(image => image.complete && image.naturalWidth > 0),
  initialLayout: await aiEntry.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { position: getComputedStyle(element).position, width: rect.width, height: rect.height, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom };
  })
};
const initialVisibleCards = await test.locator(".systems-section .data-card.is-visible").count();
await test.locator("a.cardio-card").scrollIntoViewIfNeeded();
await test.waitForTimeout(1150);
const cardioVisible = await test.locator("a.cardio-card").evaluate(el => el.classList.contains("is-visible"));
const cardioLineOffset = await test.locator(".cardio-card .chart-line").evaluate(el => getComputedStyle(el).strokeDashoffset);
const cardsForRevealTest = test.locator(".systems-section .data-card");
for (let index = 0; index < await cardsForRevealTest.count(); index++) {
  await cardsForRevealTest.nth(index).scrollIntoViewIfNeeded();
  await test.waitForTimeout(90);
}
await test.waitForTimeout(450);
aiEntryMeta.afterScrollLayout = await aiEntry.evaluate(element => {
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom };
});
const finalVisibleCards = await test.locator(".systems-section .data-card.is-visible").count();
const femaleCards = await test.locator("a.female-card").count();
const maleCards = await test.locator("a.male-card").count();
await test.locator("#replayScore").click();
await test.waitForTimeout(120);
const replayMidScore = await test.locator("#scoreValue").textContent();
await test.waitForTimeout(1450);
const replayFinalScore = await test.locator("#scoreValue").textContent();
await test.locator("a.cardio-card").click();
await test.waitForLoadState("load");
const detailChartType = await test.locator("#detailChart").getAttribute("data-chart-type");
const detailChartTitle = await test.locator("#detailChartTitle").textContent();
const detailIconPaths = await test.locator("#detailModuleIcon svg path").count();
const interaction = { score, homeTopNav, saveMeta, saveFeedback, links, productMeta, seniorType, aiEntryMeta, initialVisibleCards, finalVisibleCards, cardioVisible, cardioLineOffset, femaleCards, maleCards, replayMidScore, replayFinalScore, detail: await test.locator("#detailTitle").textContent(), detailChartType, detailChartTitle, detailIconPaths, indicators: await test.locator(".detail-indicator-list article").count(), errors: [] };
console.log(JSON.stringify({ interaction }));

const moduleCharts = {};
for (const id of ["cardio", "lung", "digest", "endocrine", "female", "immune", "bone"]) {
  await test.goto(`${pathToFileURL(path.join(here, "detail.html")).href}?id=${id}`, { waitUntil: "load" });
  moduleCharts[id] = {
    type: await test.locator("#detailChart").getAttribute("data-chart-type"),
    title: await test.locator("#detailChartTitle").textContent(),
    icon: await test.locator("#detailModuleIcon svg").count(),
    chartContent: await test.locator("#detailChart").evaluate(el => el.children.length)
  };
}
console.log(JSON.stringify({ moduleCharts }));
await test.close();

const smallContext = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "zh-CN", reducedMotion: "reduce" });
const smallPage = await smallContext.newPage();
await smallPage.goto(pathToFileURL(path.join(here, "index.html")).href, { waitUntil: "load" });
await smallPage.waitForTimeout(100);
const smallScreen = await smallPage.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, score: document.querySelector("#scoreValue")?.textContent }));
console.log(JSON.stringify({ smallScreen }));
await smallPage.goto(`${pathToFileURL(path.join(here, "detail.html")).href}?id=immune`, { waitUntil: "load" });
await smallPage.waitForTimeout(100);
const smallDetail = await smallPage.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, chartType: document.querySelector("#detailChart")?.dataset.chartType, icon: Boolean(document.querySelector("#detailModuleIcon svg")) }));
console.log(JSON.stringify({ smallDetail }));
await smallContext.close();
await browser.close();
