// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ElementPlus from "element-plus";
vi.mock("@/api/aiConsult", () => ({
  fetchAiConsultDashboard: vi.fn(),
  fetchAiConsultSessions: vi.fn(),
  fetchAiConsultSessionDetail: vi.fn(),
}));
vi.mock("vue-echarts", () => ({
  default: { name: "ChartMock", props: ["option"], template: "<div />" },
}));
import {
  fetchAiConsultDashboard,
  fetchAiConsultSessions,
  fetchAiConsultSessionDetail,
} from "@/api/aiConsult";
import { useAuthStore } from "@/stores/auth";
import AiConsultOverview from "../AiConsultOverview.vue";
import AiConsultTokenChart from "../AiConsultTokenChart.vue";

const usage = {
  input_tokens: 1000,
  output_tokens: 234,
  actual_tokens: 1234,
  reserved_tokens: 8000,
  unreported_attempts: 2,
};
const row = {
  id: "00000000-0000-4000-8000-000000000001",
  report_code: "SYNTHETIC-REPORT-1",
  customer_id: 101,
  report_date: "2026-10-09",
  source: "home",
  source_indicator_code: null,
  source_plan_id: null,
  state: "ended",
  created_at: "2026-10-09T16:00:00Z",
  last_activity_at: "2026-10-10T01:00:00Z",
  turn_count: 1,
  usage,
};
const point = { label: "00:00", ...usage, future: false };
const dash = {
  timezone: "Asia/Shanghai",
  day: "2026-10-10",
  month: "2026-10",
  generated_at: "2026-10-10T01:00:00Z",
  day_sessions: 7,
  day_completed: 9,
  day_failed: 1,
  completion_rate_percent: 90,
  running: 1,
  stale_running: 0,
  day_usage: usage,
  month_usage: { ...usage, actual_tokens: 12345 },
  hourly_trend: [point],
  daily_trend: [{ ...point, label: "01" }],
};
const turn = {
  id: 1,
  sequence: 1,
  question: "完整问题内容",
  answer: "完整回答\n<img src=x onerror=alert(1)>",
  status: "completed",
  created_at: row.created_at,
  completed_at: row.last_activity_at,
  feedback: "helpful",
  evidence: [{ label: "报告指标依据", kind: "report" }],
  attempts: [
    {
      attempt_number: 1,
      status: "completed",
      model_code: "test-model",
      input_tokens: 1000,
      output_tokens: 234,
      actual_tokens: 1234,
      reserved_tokens: 0,
      error_category: null,
      started_at: row.created_at,
      finished_at: row.last_activity_at,
    },
  ],
};
const wrappers: VueWrapper[] = [];
function mountOverview(actions = ["view", "conversation"]) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.roles = ["operator"];
  auth.menus = [{ id: 42, route_path: "/health/ai-consult-overview" }];
  auth.permissions = { 42: actions };
  const wrapper = mount(AiConsultOverview, {
    attachTo: document.body,
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        teleport: true,
        ElSelect: { props: ["modelValue"], template: "<select />" },
        ElOption: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll("button").find((item) => item.text() === text)!;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAiConsultDashboard).mockResolvedValue({ data: dash } as any);
  vi.mocked(fetchAiConsultSessions).mockResolvedValue({
    data: { records: [row], total: 1, page: 1, page_size: 20 },
  } as any);
  vi.mocked(fetchAiConsultSessionDetail).mockResolvedValue({
    data: {
      session: row,
      turns: [turn],
      limit: 30,
      offset: 0,
      has_more: false,
    },
  } as any);
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});

describe("redesigned AI consultation overview", () => {
  it("has four metrics, two trends and session metadata, not the removed cards or bodies", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    expect(wrapper.findAll(".metric")).toHaveLength(4);
    for (const label of ["提问轮次", "生成尝试", "首次可展示回答"])
      expect(wrapper.text()).not.toContain(label);
    expect(wrapper.text()).toContain("当日 token 消耗");
    expect(wrapper.text()).toContain("当月 token 消耗");
    expect(wrapper.find(".metric.accent strong").text()).toBe("1,234");
    expect(wrapper.find(".metric.teal strong").text()).toBe("12,345");
    expect(wrapper.text()).toContain("待回传预留 8,000");
    expect(wrapper.findAllComponents(AiConsultTokenChart)).toHaveLength(2);
    expect(wrapper.text()).toContain("SYNTHETIC-REPORT-1");
    expect(wrapper.text()).toContain("101");
    expect(wrapper.text()).not.toContain("完整问题内容");
    expect(fetchAiConsultSessionDetail).not.toHaveBeenCalled();
  });
  it("queries report and user filters with a new first page and can reset", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    await wrapper
      .get('input[aria-label="报告编号"]')
      .setValue(" SYNTHETIC-REPORT-1 ");
    await wrapper.get('input[aria-label="用户 ID"]').setValue("101");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(fetchAiConsultSessions).toHaveBeenLastCalledWith({
      report_code: "SYNTHETIC-REPORT-1",
      customer_id: 101,
      page: 1,
      page_size: 10,
    });
    await button(wrapper, "重置").trigger("click");
    await flushPromises();
    expect(fetchAiConsultSessions).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 10,
    });
  });
  it("rejects invalid user ID without sending a query", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    await wrapper.get('input[aria-label="用户 ID"]').setValue("-1");
    await wrapper.get("form").trigger("submit");
    expect(fetchAiConsultSessions).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("有效的正整数");
  });
  it("changes calendar periods and session pages independently", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    const day = wrapper.findAllComponents({ name: "ElDatePicker" })[0];
    day.vm.$emit("update:modelValue", "2026-10-08");
    (day.vm.$attrs.onChange as () => void)();
    await flushPromises();
    expect(fetchAiConsultDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({ day: "2026-10-08" }),
    );
    const pagination = wrapper.findComponent({ name: "ElPagination" });
    pagination.vm.$emit("update:current-page", 2);
    pagination.vm.$emit("current-change", 2);
    await flushPromises();
    expect(fetchAiConsultSessions).toHaveBeenLastCalledWith({
      page: 2,
      page_size: 10,
    });
  });
  it("opens full ordered plain-text dialogue on demand, escapes markup and shows evidence", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    await button(wrapper, "查看对话").trigger("click");
    await flushPromises();
    expect(fetchAiConsultSessionDetail).toHaveBeenCalledWith(row.id, {
      limit: 30,
      offset: 0,
    });
    expect(wrapper.text()).toContain("完整问题内容");
    expect(wrapper.text()).toContain("完整回答");
    expect(wrapper.text()).toContain("<img src=x onerror=alert(1)>");
    expect(wrapper.find(".answer img").exists()).toBe(false);
    expect(wrapper.text()).toContain("报告指标依据");
    expect(wrapper.text()).toContain("查看操作会记录审计");
  });
  it("loads additional turns without duplicating previously loaded turns", async () => {
    vi.mocked(fetchAiConsultSessionDetail).mockResolvedValueOnce({
      data: {
        session: row,
        turns: [turn],
        limit: 30,
        offset: 0,
        has_more: true,
      },
    } as any);
    vi.mocked(fetchAiConsultSessionDetail).mockResolvedValueOnce({
      data: {
        session: row,
        turns: [turn, { ...turn, id: 2, sequence: 2 }],
        limit: 30,
        offset: 1,
        has_more: false,
      },
    } as any);
    const wrapper = mountOverview();
    await flushPromises();
    await button(wrapper, "查看对话").trigger("click");
    await flushPromises();
    await button(wrapper, "加载更多对话").trigger("click");
    await flushPromises();
    expect(fetchAiConsultSessionDetail).toHaveBeenLastCalledWith(row.id, {
      limit: 30,
      offset: 1,
    });
    expect(wrapper.findAll(".turn")).toHaveLength(2);
    expect(wrapper.text()).toContain("已展示全部 2 轮对话");
  });
  it("view-only roles cannot request private conversation content", async () => {
    const wrapper = mountOverview(["view"]);
    await flushPromises();
    expect(wrapper.text()).toContain("需对话权限");
    expect(wrapper.text()).not.toContain("查看对话");
    expect(fetchAiConsultSessionDetail).not.toHaveBeenCalled();
  });
  it("does not load statistics or sessions without overview view permission", async () => {
    const wrapper = mountOverview([]);
    await flushPromises();
    expect(wrapper.text()).toContain("暂无运行概览查看权限");
    expect(fetchAiConsultDashboard).not.toHaveBeenCalled();
    expect(fetchAiConsultSessions).not.toHaveBeenCalled();
  });
  it("masks storage failures and clears stale metrics", async () => {
    const wrapper = mountOverview();
    await flushPromises();
    vi.mocked(fetchAiConsultDashboard).mockRejectedValueOnce(
      new Error("PRIVATE SQL"),
    );
    vi.mocked(fetchAiConsultSessions).mockRejectedValueOnce(
      new Error("PRIVATE SQL"),
    );
    await button(wrapper, "刷新数据").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("用量统计暂时不可用");
    expect(wrapper.text()).toContain("会话列表暂时不可用");
    expect(wrapper.findAll(".metric")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("SYNTHETIC-REPORT-1");
    expect(wrapper.text()).not.toContain("PRIVATE SQL");
  });
  it("shows missing completion samples as a dash, not a false 100% success", async () => {
    vi.mocked(fetchAiConsultDashboard).mockResolvedValueOnce({
      data: { ...dash, completion_rate_percent: null },
    } as any);
    const wrapper = mountOverview();
    await flushPromises();
    expect(wrapper.findAll(".metric strong")[1].text()).toBe("—");
  });
  it("keeps private content absent when detail authorization fails", async () => {
    vi.mocked(fetchAiConsultSessionDetail).mockRejectedValueOnce({
      response: { status: 403 },
    });
    const wrapper = mountOverview();
    await flushPromises();
    await button(wrapper, "查看对话").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("没有查看完整对话的权限");
    expect(wrapper.text()).not.toContain("完整问题内容");
  });
});

it("charts preserve future null gaps and keep reservation series outside actual stacks", () => {
  const wrapper = mount(AiConsultTokenChart, {
    props: {
      label: "test chart",
      points: [
        point,
        {
          ...point,
          label: "01:00",
          input_tokens: null,
          output_tokens: null,
          actual_tokens: null,
          reserved_tokens: null,
          future: true,
        },
      ],
    },
  });
  wrappers.push(wrapper);
  const option = wrapper.findComponent({ name: "ChartMock" }).props("option");
  expect(option.series[0].data).toEqual([1000, null]);
  expect(option.series[1].data).toEqual([234, null]);
  expect(option.series[2].data).toEqual([8000, null]);
  expect(option.series[2].stack).toBeUndefined();
  expect(option.tooltip.renderMode).toBe("richText");
  expect(option.series[0].connectNulls).toBe(false);
});
