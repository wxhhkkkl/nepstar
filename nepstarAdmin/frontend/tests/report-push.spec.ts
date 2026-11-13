import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: { records: [], total: 0 } }),
  post: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
}));

vi.mock('@/api/client', () => ({ default: api }));

import {
  PUSH_REASON_KEYS,
  getPushRecords,
  pushReport,
  repushRecord,
} from '@/api/reports';

beforeEach(() => {
  api.get.mockClear();
  api.post.mockClear();
});

describe('report push API', () => {
  it('posts to the manual push endpoint', async () => {
    await pushReport(12);
    expect(api.post).toHaveBeenCalledWith('/reports/12/push');
  });

  it('maps push-record filters to query params', async () => {
    await getPushRecords({
      page: 2,
      page_size: 20,
      status: 'failed',
      trigger_type: 'auto',
      start_date: '2026-11-01',
      end_date: '2026-11-13',
      sn: 'KH503',
    });
    expect(api.get).toHaveBeenCalledWith('/reports/push-records', {
      params: {
        page: 2,
        page_size: 20,
        status: 'failed',
        trigger_type: 'auto',
        start_date: '2026-11-01',
        end_date: '2026-11-13',
        sn: 'KH503',
      },
    });
  });

  it('posts to the repush endpoint', async () => {
    await repushRecord(7);
    expect(api.post).toHaveBeenCalledWith('/reports/push-records/7/repush');
  });

  it('exposes failure-reason translations', () => {
    expect(PUSH_REASON_KEYS['delivery.timeout']).toBe('pushReasonTimeout');
    expect(PUSH_REASON_KEYS['report.not_found']).toBe('pushReasonNotFound');
  });
});
