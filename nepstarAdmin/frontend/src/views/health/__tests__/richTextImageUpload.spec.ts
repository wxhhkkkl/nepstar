import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/health', () => ({
  uploadProductImage: vi.fn(),
}));

import { uploadProductImage } from '@/api/health';
import { customUploadImage } from '../richTextImageUpload';

const file = new File([new Uint8Array([1, 2, 3])], 'detail.png', { type: 'image/png' });

beforeEach(() => {
  vi.mocked(uploadProductImage).mockReset();
});

describe('customUploadImage (wangEditor → OSS)', () => {
  it('uploads through the backend and inserts the OSS URL (not base64)', async () => {
    vi.mocked(uploadProductImage).mockResolvedValue({
      data: { url: 'https://nepstar.oss-cn-beijing.aliyuncs.com/health/products/abc.png' },
    } as any);
    const insertFn = vi.fn();
    await customUploadImage(file, insertFn);

    expect(uploadProductImage).toHaveBeenCalledWith(file);
    expect(insertFn).toHaveBeenCalledTimes(1);
    const [url, alt, href] = insertFn.mock.calls[0];
    expect(url).toContain('/health/products/');
    expect(alt).toBe('detail.png');
    expect(href).toBe(url);
  });

  it('reports an error and inserts nothing when the upload fails', async () => {
    vi.mocked(uploadProductImage).mockRejectedValue({ message: 'product.upload_failed' });
    const insertFn = vi.fn();
    const onError = vi.fn();
    await customUploadImage(file, insertFn, onError);

    expect(insertFn).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('product.upload_failed');
  });

  it('reports an error when the response carries no url', async () => {
    vi.mocked(uploadProductImage).mockResolvedValue({ data: {} } as any);
    const insertFn = vi.fn();
    const onError = vi.fn();
    await customUploadImage(file, insertFn, onError);

    expect(insertFn).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('health.uploadFailed');
  });
});
