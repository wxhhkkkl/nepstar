# KH503machine

名医云检测仪 / KH503 一体机 React Native Android 客户端。

当前统一使用 **React 16.8.6 + React Native 0.60.3**，以 `package-lock.json` 为唯一依赖锁。旧 Yarn 锁文件对应其他版本，已移出工程。结构、硬件依赖和兼容问题见 [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md)。

检测模式 **`handleMode = 31`**：保留原模式 31 的业务流程，免除头部及左右腿的佩戴检查和提醒；双手、指夹及原报告数据校验继续保留。模式 30 不再免头腿，恢复完整的头部和左右腿佩戴要求。不再启用新增模式 32。说明见 [MODE31.md](MODE31.md)，此前模式 30 方案见 [MODE30.md](MODE30.md)，离线检查执行 `npm run test:mode`。

大屏启动修复历史见 [STARTUP_FIX.md](STARTUP_FIX.md)，当前摄像头及原流程恢复修订见 [CAMERA_FIX.md](CAMERA_FIX.md)。人脸 SDK 的 `.iml` 为必需模型数据，Gradle 会检查完整性；发布前还需执行 `python3 scripts/verify-face-models.py --apk <安装包路径>`。

## 在连接的 Android 手机上运行

本机工具：Java 8、Android SDK 28、Build Tools 28.0.3、ADB；Gradle Wrapper 为 6.0.1。JavaScript 打包优先使用本机 `/usr/local/bin/node` 的 Node 12。安装依赖使用 Node 20/npm 10，避免旧 npm 6 的解析错误：

```sh
npm ci --legacy-peer-deps --omit=optional
npm run android:phone
```

`postinstall` 会对旧原生依赖应用可重复的 AndroidX/Gradle 兼容修复。若安装时关闭了 lifecycle scripts，再执行：

```sh
node scripts/prepare-legacy-android.js
```

运行脚本编译、安装并启动 `robot.kj.com.phone`，显示名称为「名医云检测仪（手机预览）」。APK 内置 JS 与图片/视频资源，无需常驻 Metro。若连接多台设备，先设置 `ANDROID_SERIAL`。可通过 `KH503_JAVA_HOME`、`KH503_NODE_BINARY` 覆盖对应工具路径。

手机预览跳过设备自检、串口/心电初始化和自动升级，并显示提示。真实测量、设备固件和云端报告流程需要一体机硬件及服务支持。

## 一体机工程

正式包名仍为 `robot.kj.com`。不传 `-PphonePreview=true` 时保留硬件启动流程；release 的预览开关恒为 false。此次验证以连接的 Android 手机为准，一体机硬件和 release 需另行回归。

无需 `sudo`，也不必移动项目到用户目录顶层。本机旧 Watchman 的 ICU 动态库缺失，手机运行脚本在打包时关闭文件监听；重新构建会重新读取源文件。
