import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "zh-CN" });

async function openLocal(page, file, suffix = "") {
  await page.goto(`${pathToFileURL(path.join(here, file)).href}${suffix}`, { waitUntil: "load" });
}

async function screenshot(file, suffix, output, wait = 1700) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await openLocal(page, file, suffix);
  await page.waitForTimeout(wait);
  if (file === "index.html") {
    const cards = page.locator(".systems-section .data-card");
    for (let index = 0; index < await cards.count(); index++) {
      await cards.nth(index).scrollIntoViewIfNeeded();
      await page.waitForTimeout(190);
    }
    await page.waitForTimeout(850);
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

await screenshot("index.html", "", "长寿指数报告V3_手机长图.png");
await screenshot("detail.html", "?id=immune", "长寿指数报告V3_免疫力详情页.png", 220);

const test = await context.newPage();
const errors = [];
test.on("pageerror", error => errors.push(error.message));
await openLocal(test, "index.html");
await test.waitForTimeout(1600);
const score = await test.locator("#scoreValue").textContent();
const cards = test.locator(".systems-section a.data-card");
const links = await cards.count();
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
const initialVisible = await test.locator(".systems-section .data-card.is-visible").count();
const saveMeta = { href: await test.locator("#saveReport").getAttribute("href"), download: await test.locator("#saveReport").getAttribute("download") };
for (let index = 0; index < links; index++) {
  await cards.nth(index).scrollIntoViewIfNeeded();
  await test.waitForTimeout(150);
}
await test.waitForTimeout(650);
aiEntryMeta.afterScrollLayout = await aiEntry.evaluate(element => {
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom };
});
const finalVisible = await test.locator(".systems-section .data-card.is-visible").count();
const uniqueCharts = {
  cardio: await test.locator(".cardio-card .cardio-chart").count(),
  lung: await test.locator(".lung-card .lung-visual").count(),
  endocrine: await test.locator(".endocrine-card .endo-heat").count(),
  digest: await test.locator(".digest-card .digest-flow").count(),
  female: await test.locator(".female-card .female-radar").count(),
  immune: await test.locator(".immune-card .immune-network").count(),
  bone: await test.locator(".bone-card .bone-chart").count()
};
const gender = { female: await test.locator(".female-card").count(), male: await test.locator(".male-card").count() };
await test.locator(".cardio-card").click();
await test.waitForLoadState("load");
const detail = { title: await test.locator("#detailTitle").textContent(), chart: await test.locator("#detailChart").getAttribute("data-chart-type"), icon: await test.locator("#detailModuleIcon svg").count() };
console.log(JSON.stringify({ interaction: { score, links, aiEntryMeta, initialVisible, finalVisible, saveMeta, uniqueCharts, gender, detail, errors } }));

const moduleCharts = {};
for (const id of ["cardio", "lung", "digest", "endocrine", "female", "immune", "bone"]) {
  await openLocal(test, "detail.html", `?id=${id}`);
  moduleCharts[id] = { type: await test.locator("#detailChart").getAttribute("data-chart-type"), icon: await test.locator("#detailModuleIcon svg").count(), content: await test.locator("#detailChart").evaluate(el => el.children.length) };
}
console.log(JSON.stringify({ moduleCharts }));
await test.close();

const smallContext = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "zh-CN", reducedMotion: "reduce" });
const small = await smallContext.newPage();
await openLocal(small, "index.html");
await small.waitForTimeout(100);
const smallHome = await small.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, score: document.querySelector("#scoreValue")?.textContent }));
await openLocal(small, "detail.html", "?id=immune");
await small.waitForTimeout(100);
const smallDetail = await small.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, chart: document.querySelector("#detailChart")?.dataset.chartType }));
console.log(JSON.stringify({ smallHome, smallDetail }));
await smallContext.close();
await browser.close();
