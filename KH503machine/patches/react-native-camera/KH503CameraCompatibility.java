package com.google.android.cameraview;

/** The KJ501 camera is mounted at 90 degrees although its HAL reports zero. */
public final class KH503CameraCompatibility {
    private KH503CameraCompatibility() {}

    public static int rotation(String model, String device, int cameraId,
                               int facing, int fallback) {
        boolean supported = "KJ501".equals(model) ||
                ("rk3288".equals(model) && "rk3288".equals(device));
        // CAMERA_FACING_BACK == 0. Leave every other camera/device unchanged.
        return supported && cameraId == 0 && facing == 0 ? 90 : fallback;
    }

    public static float previewRatio(String model, String device, int facing,
                                     boolean landscape, float ratio) {
        // RNCameraView otherwise lays out a landscape texture even though the
        // kiosk's Camera1 preview has already been rotated into portrait.
        return landscape && rotation(model, device, 0, facing, -1) == 90
                ? 1f / ratio : ratio;
    }
}
