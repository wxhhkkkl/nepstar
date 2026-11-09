const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

process.chdir(path.resolve(__dirname, '..'));
execFileSync(process.execPath, ['node_modules/jetifier/bin/jetify'], {stdio: 'inherit'});

// All manually linked packages share the root Android Gradle plugin. Old
// package-local plugins otherwise resolve obsolete Google/JCenter toolchains.
const settings = fs.readFileSync('android/settings.gradle', 'utf8');
const folders = [...settings.matchAll(/'\.\.\/(node_modules\/[^']+)'/g)].map(m => m[1]);
function removeBlock(text, name) {
  const start = text.search(new RegExp('^' + name + '\\s*\\{', 'm'));
  if (start === -1) return text;
  let i = text.indexOf('{', start), depth = 1;
  while (depth && ++i < text.length) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
  }
  if (depth) throw new Error('Unbalanced ' + name + ' block');
  return text.slice(0, start) + text.slice(i + 1);
}
for (const folder of folders) {
  const file = path.join(folder, 'build.gradle');
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  text = removeBlock(text, 'buildscript');
  if (folder.includes('@react-native-community/netinfo')) {
    text = removeBlock(removeBlock(text, 'plugins'), 'spotless');
  }
  text = text.replace(/com\.aliyun\.dpa:oss-android-sdk:\+/g, 'com.aliyun.dpa:oss-android-sdk:2.9.12');
  fs.writeFileSync(file, text);
}
console.log('Prepared legacy native packages for AndroidX and the root Gradle plugin.');

// The host's old Watchman binary cannot load its ICU library. Bundling does not
// need filesystem subscriptions, so allow the run script to disable them.
const graphFile = 'node_modules/metro/src/node-haste/DependencyGraph.js';
let graph = fs.readFileSync(graphFile, 'utf8');
graph = graph.replace('watch: true', 'watch: process.env.KH503_DISABLE_WATCH !== "1"');
fs.writeFileSync(graphFile, graph);

// The pinned camera fork stores this file under camera/utils but declares
// the application's package instead, so RNCameraView cannot import it.
const yuvFile = 'node_modules/react-native-camera/android/src/main/java/org/reactnative/camera/utils/YuvUtil.java';
let yuv = fs.readFileSync(yuvFile, 'utf8');
fs.writeFileSync(yuvFile, yuv.replace('package robot.kj.com.utils;', 'package org.reactnative.camera.utils;'));

// Restore the camera bridge contract used by RNFindFaceModule. These hooks
// are referenced by the application but absent from the pinned fork.
const cameraFile = 'node_modules/react-native-camera/android/src/main/java/com/google/android/cameraview/Camera1.java';
let camera = fs.readFileSync(cameraFile, 'utf8');
camera = camera.replace(/^class Camera1 extends/m, 'public class Camera1 extends');
if (!camera.includes('public static volatile int previewWidth')) {
  camera = camera.replace('private static final int INVALID_CAMERA_ID',
    'public static volatile int previewWidth = 640;\n    public static volatile int previewHeight = 480;\n\n    private static final int INVALID_CAMERA_ID');
  camera = camera.replace('mCameraParameters.setPreviewSize(640, 480);',
    'mCameraParameters.setPreviewSize(previewWidth, previewHeight);');
}
// Restore the original kiosk's mounting compensation. Generic phones and other
// cameras retain Camera1's normal sensor/display calculations.
const cameraCompatFile = 'node_modules/react-native-camera/android/src/main/java/com/google/android/cameraview/KH503CameraCompatibility.java';
fs.copyFileSync('patches/react-native-camera/KH503CameraCompatibility.java', cameraCompatFile);
for (const name of ['calcDisplayOrientation', 'calcCameraRotation']) {
  const signature = `private int ${name}(int screenOrientationDegrees) {`;
  if (!camera.includes(`${signature}\n        // KH503 mounting compensation`)) {
    camera = camera.replace(signature, `${signature}
        // KH503 mounting compensation
        int mountedRotation = KH503CameraCompatibility.rotation(Build.MODEL, Build.DEVICE,
                mCameraId, mCameraInfo.facing, -1);
        if (mountedRotation >= 0) return mountedRotation;`);
  }
}
fs.writeFileSync(cameraFile, camera);

const viewFile = 'node_modules/react-native-camera/android/src/main/java/org/reactnative/camera/RNCameraView.java';
let view = fs.readFileSync(viewFile, 'utf8');
if (!view.includes('KH503CameraCompatibility.previewRatio')) {
  const anchor = 'int orientation = getResources().getConfiguration().orientation;';
  if (!view.includes(anchor)) throw new Error('Camera preview layout changed; review the kiosk patch.');
  view = view.replace(anchor, `${anchor}
    ratio = com.google.android.cameraview.KH503CameraCompatibility.previewRatio(
        android.os.Build.MODEL, android.os.Build.DEVICE, getFacing(),
        orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE, ratio);`);
}
if (!view.includes('public static volatile byte[] nv21Bytes')) {
  view = view.replace(/(public class RNCameraView[^\{]*\{)/,
    '$1\n  public static volatile byte[] nv21Bytes;');
  view = view.replace('if (data.length < (1.5 * width * height))',
    'if (nv21Bytes == null) nv21Bytes = data.clone();\n         if (data.length < (1.5 * width * height))');
}
if (!view.includes('public static volatile int imageWidth')) {
  view = view.replace('public static volatile byte[] nv21Bytes;',
    'public static volatile byte[] nv21Bytes;\n  public static volatile int imageWidth = 640;\n  public static volatile int imageHeight = 480;');
}
// Match the working kiosk APK: hand frames to Orion at 300 ms intervals.
// The pinned fork additionally ran an Android face detector in a new thread
// on each interval; the app already owns face detection through Orion.
const frameSignature = 'public void onFramePreview(final CameraView cameraView,final byte[] data, int width, int height, int rotation) {';
const frameStart = view.indexOf(frameSignature);
if (frameStart < 0) throw new Error('Camera preview callback changed; review the kiosk patch.');
const frameBodyStart = frameStart + frameSignature.length;
let frameEnd = frameBodyStart, frameDepth = 1;
while (frameDepth && frameEnd < view.length) {
  const ch = view[frameEnd++];
  if (ch === '{') frameDepth++;
  else if (ch === '}') frameDepth--;
}
if (frameDepth) throw new Error('Unbalanced camera preview callback');
view = view.slice(0, frameBodyStart) + `
        // KH503 preview frames: one producer for the existing Orion consumer.
        if (data == null || data.length < width * height * 3 / 2) return;
        long now = System.currentTimeMillis();
        if (now - lastPreviewTime >= 300) {
          lastPreviewTime = now;
          imageWidth = width;
          imageHeight = height;
          nv21Bytes = data.clone();
        }
      }` + view.slice(frameEnd);
if (!view.includes('"capture bridge request"')) {
  view = view.replace('public void takePicture(ReadableMap options, final Promise promise, File cacheDirectory) {',
    'public void takePicture(ReadableMap options, final Promise promise, File cacheDirectory) {\n    android.util.Log.d("KH503_CAMERA", "capture bridge request");');
  view = view.replace('public void onPictureTaken(CameraView cameraView, final byte[] data) {',
    'public void onPictureTaken(CameraView cameraView, final byte[] data) {\n        android.util.Log.d("KH503_CAMERA", "JPEG callback bytes=" + (data == null ? 0 : data.length));');
}
fs.writeFileSync(viewFile, view);

const pictureTaskFile = 'node_modules/react-native-camera/android/src/main/java/org/reactnative/camera/tasks/ResolveTakenPictureAsyncTask.java';
let pictureTask = fs.readFileSync(pictureTaskFile, 'utf8');
if (!pictureTask.includes('"JPEG processing started"')) {
  pictureTask = pictureTask.replace('protected WritableMap doInBackground(Void... voids) {',
    'protected WritableMap doInBackground(Void... voids) {\n        android.util.Log.d("KH503_CAMERA", "JPEG processing started");');
  pictureTask = pictureTask.replace('protected void onPostExecute(WritableMap response) {',
    'protected void onPostExecute(WritableMap response) {\n        android.util.Log.d("KH503_CAMERA", "JPEG processing completed=" + (response != null));');
}
fs.writeFileSync(pictureTaskFile, pictureTask);

// Metro 0.54's Symbol fallback must skip its replacement expression, not
// stop traversal of the entire module (which leaves Flow/imports uncompiled).
const symbolFile = 'node_modules/metro-react-native-babel-preset/src/transforms/transform-symbol-member.js';
let symbol = fs.readFileSync(symbolFile, 'utf8');
fs.writeFileSync(symbolFile, symbol.replace('path.stop();', 'path.skip();'));

// Preserve the code-49 geometry; optional diagnostics are enabled only by
// the mode-2 report page. Keep vendor patches across dependency installation.
for (const file of ['Canvas.js', 'QRCode.js']) {
  fs.copyFileSync(path.join('patches/react-native-qrcode', file),
    path.join('node_modules/react-native-qrcode/lib', file));
}

// React can set capInsets before source. Loading with a null URI crashes the
// upgrade screen's AsyncTask; a failed image decode must also be harmless.
const capViewFile = 'node_modules/react-native-image-capinsets/android/src/main/java/dk/madslee/imageCapInsets/RCTImageCapInsetView.java';
let capView = fs.readFileSync(capViewFile, 'utf8');
if (!capView.includes('if (mUri == null || mUri.length() == 0) return;')) {
  capView = capView.replace('public void reload() {',
    'public void reload() {\n        if (mUri == null || mUri.length() == 0) return;');
}
if (!capView.includes('if (bitmap == null) return;')) {
  capView = capView.replace('public void onImageLoaded(Bitmap bitmap) {',
    'public void onImageLoaded(Bitmap bitmap) {\n                if (bitmap == null) return;');
}
fs.writeFileSync(capViewFile, capView);

const capLoaderFile = 'node_modules/react-native-image-capinsets/android/src/main/java/dk/madslee/imageCapInsets/utils/RCTImageLoaderTask.java';
let capLoader = fs.readFileSync(capLoaderFile, 'utf8');
if (!capLoader.includes('if (mUri == null || mUri.length() == 0) return null;')) {
  capLoader = capLoader.replace('protected Bitmap doInBackground(String... params) {',
    'protected Bitmap doInBackground(String... params) {\n        if (mUri == null || mUri.length() == 0) return null;');
}
fs.writeFileSync(capLoaderFile, capLoader);
