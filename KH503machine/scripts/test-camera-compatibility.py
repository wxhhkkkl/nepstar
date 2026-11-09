#!/usr/bin/env python3
"""Run the exact native mounting policy on the JVM (no device capture)."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'patches/react-native-camera/KH503CameraCompatibility.java'
TEST = '''
import com.google.android.cameraview.KH503CameraCompatibility;
public class CameraCompatibilityTest {
  public static void main(String[] args) {
    for (int fallback : new int[]{0, 90, 180, 270, -1}) {
      check(90, "KJ501", "rk3288", 0, 0, fallback);
      check(90, "rk3288", "rk3288", 0, 0, fallback);
      check(fallback, "KJ501", "rk3288", 1, 0, fallback);
      check(fallback, "KJ501", "rk3288", 0, 1, fallback);
      check(fallback, "SM_S908U", "b0q", 0, 0, fallback);
      check(fallback, "Other", "rk3288", 0, 0, fallback);
      check(fallback, null, null, 0, 0, fallback);
    }
    float ratio = 4f / 3f;
    float kiosk = KH503CameraCompatibility.previewRatio("KJ501", "rk3288", 0, true, ratio);
    if (Math.abs(kiosk - 0.75f) > 0.00001f) throw new AssertionError("portrait texture");
    // A 486x648 view must keep its full 486x648 image, instead of cropping 864x648.
    int width = (int) (648 * kiosk);
    if (width != 486) throw new AssertionError("preview crop: " + width);
    for (String model : new String[]{"SM_S908U", "Other", null}) {
      if (KH503CameraCompatibility.previewRatio(model, "rk3288", 0, true, ratio) != ratio)
        throw new AssertionError("non-kiosk preview changed");
    }
    if (KH503CameraCompatibility.previewRatio("KJ501", "rk3288", 1, true, ratio) != ratio)
      throw new AssertionError("front camera changed");
    if (KH503CameraCompatibility.previewRatio("KJ501", "rk3288", 0, false, ratio) != ratio)
      throw new AssertionError("portrait display changed");
    System.out.println("42 camera rotation and preview geometry cases passed");
  }
  private static void check(int expected, String model, String device,
                            int cameraId, int facing, int fallback) {
    int actual = KH503CameraCompatibility.rotation(model, device, cameraId, facing, fallback);
    if (expected != actual) throw new AssertionError(model + ": " + actual);
  }
}
'''
with tempfile.TemporaryDirectory(prefix='kh503-camera-') as directory:
    test = Path(directory) / 'CameraCompatibilityTest.java'
    test.write_text(TEST)
    subprocess.run(['javac', '-d', directory, str(SOURCE), str(test)], check=True)
    subprocess.run(['java', '-cp', directory, 'CameraCompatibilityTest'], check=True)
