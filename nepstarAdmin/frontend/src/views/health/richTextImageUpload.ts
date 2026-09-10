import { uploadProductImage } from '@/api/health';

/**
 * wangEditor `MENU_CONF.uploadImage.customUpload` handler.
 *
 * Without this, wangEditor inlines inserted images as base64 into `detail_html`.
 * Here every image goes through our backend to Aliyun OSS (bucket `nepstar`) and
 * the editor stores the resulting public URL instead.
 */
export async function customUploadImage(
  file: File,
  insertFn: (url: string, alt?: string, href?: string) => void,
  onError?: (key: string) => void,
): Promise<void> {
  try {
    const r = await uploadProductImage(file);
    const url = r?.data?.url;
    if (!url) {
      onError?.('health.uploadFailed');
      return;
    }
    insertFn(url, file.name, url);
  } catch (e: any) {
    onError?.(e?.message || 'health.uploadFailed');
  }
}
