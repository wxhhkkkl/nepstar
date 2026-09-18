# Contracts: V2 Vue Migration

本功能不暴露网络 API。契约用于约束 Vue 页面、模拟数据和用户可见行为：

- [mock-report-data.md](mock-report-data.md)：首页与详情共享的模拟报告数据契约。
- [ui-behavior.md](ui-behavior.md)：页面入口、导航、动画、下载、资源和错误回退契约。

实施和测试不得通过更改这些契约来规避迁移前后的等价要求；若业务行为需要变化，应先修改 `spec.md` 并重新通过宪章检查。
