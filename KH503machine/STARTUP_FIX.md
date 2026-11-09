# 大屏更新 APK 后启动失败修复（2026-11-02）

## 已定位的三处错误

1. **人脸模型缺失导致原生崩溃。** 设备原始堆栈为 `libc.fseeko → IML_pred_load → vision::SSD::init → OrionVision.facekeypointInitsingle`，信号为 SIGSEGV。设备实际安装的故障包 SHA256 与此前交付包一致：`2c4c89fb0987e9b58d6a6e3df5fb6d75e9741e562461cf460edffaaf2ab8624c`。
2. **正式包静默日志时丢失 console.assert。** 模型补齐后，在网络初始化阶段出现 `JavascriptException: console.assert is not a function`，Bugly 本地记录时间为 16:14:24。原 `App.js` 替换整个 console 对象，而 RN 的网络 EventTarget 会调用 assert。
3. **升级页图片组件在 source 设置前开始加载。** 完成网络和硬件自检后，设备于 16:20:29 进入待机页（当时云端下发模式 30），随后因服务器版本为 KHL17.0.4 进入升级页。原图片组件先收到 capInsets 时会启动空 URI 的 AsyncTask，16:20:35 抛出 `NullPointerException: String.startsWith`。已增加 URI 未就绪和图片解码失败的保护，并纳入 postinstall 兼容补丁。

## 修复

- 从设备保留的旧版 `/data/app/robot.kj.com-8/base.apk` 恢复 6 个 v7/v8 `.iml` 模型，已有两个人脸数据文件逐字节相同。旧 APK 的 SHA256 为 `9bd8400478d5d397866781b94110f07ec6749e4e7ce537342de00e595737c65e`；新旧 APK 的 `liborionvision-lib.so` 完全相同，SHA256 为 `349fdc8ed38b3d09c9c66bd787574cf328adf3e397deacc0f18a2d66508248e2`。
- SDK 字节码显示 initModel 需要带架构前缀的 face/keypoint 模型，但原仓库仅有两个数据文件。`.gitignore` 的 `*.iml` 同时匹配了这些运行时模型；已为模型目录加例外。
- `android/app/src/main/face-models.json` 固定 8 个模型资源、SDK JAR 及原生库的校验值。Gradle `verifyFaceModels` 在每次 preBuild 执行，缺失、截断或校验不符则失败。
- `scripts/verify-face-models.py --apk <apk>` 检查最终安装包。已验证可接受原版完整 APK、拒绝故障包的 6 个缺失项。
- release 保留原 console 对象，只静默原先的五个日志方法，保留 assert、time 等其他 API。
- 原生异常处理器增加 `KH503_CRASH` 完整异常堆栈日志，避免只重启而没有日志。
- `scripts/prepare-legacy-android.js` 对图片组件增加空 URI/空 Bitmap 保护，依赖重装后会自动恢复补丁。

## 修复包

最终包输出到 `dist/KH503-KHL17.0.4-mode32.apk`，校验值见同目录的 `SHA256SUMS`。

中间诊断包 SHA256：`6356e3a1de49e7868e0f3fe9c47526249a70ffa199b9c56e0a8c7d6df867df9f`，该包已修复模型与 console 问题，但尚未包含第三项修复，不应用于发布。

最终包名仍为 `robot.kj.com`，沿用原签名；版本对齐服务器为 **`KHL17.0.4 / 42`**，避免与服务器版本不同而再次进入自动升级。此前缺模型的包已在本地改名为 `KH503-mode32-missing-models-do-not-use.apk`，不可再用于服务器发布。

## 验证

- 20 项离线检查通过，包括 console.assert 回归、模式 32 与其他模式隔离、真实报告数据校验。
- release 编译通过，最终 APK 的 8 个模型和原生 SDK 校验通过。
- 实机已验证模型及 console 修复后能够完成网络初始化和硬件自检、进入原模式待机页；最终包新增了升级页修复与版本对齐。
- 用户随后明确要求仅打包输出，不再继续部署。因此最终 KHL17.0.4 包未安装到设备进行回归；无头腿真实出报告仍需单独的受控检测验证。

## 后续授权安装验证（2026-11-02）

用户随后要求直接安装本地 APK；此时服务器已下发 KHL17.0.4。已于 16:46:40 覆盖安装最终包并保留应用数据，设备包管理器确认为 KHL17.0.4 / 42，设备 APK 的 SHA256 与 dist 包一致：`88579d80de5f26de136bc238591150d5b90a9e95ebcbf667e77b0351556e2f81`。

16:47:37 完成网络和硬件自检、进入模式 32 待机；16:47:42 收到服务器 KHL17.0.4，未进入升级页。截至 16:48:35，同一进程持续存活，安装后的启动记录为一次、升级页记录为零。随后画面已进入皮肤采集流程，未操作检测按钮或提交任何检测报告。此次验证仅覆盖安装、启动与更新判断，不代表免头腿检测的报告生成已验收。
