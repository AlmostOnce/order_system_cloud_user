# 蒸汽模式迁移记录

## 已完成

- manifest.json：vapor=true、styleIsolationVersion=2。
- App、14 个页面、3 个组件全部改为 script setup lang=uts，组件通过导入自动注册。
- 生命周期改为组合式钩子；保留登录路由、异步保护、幂等重试、支付密码离开清空和头像预览逻辑。
- reactive + toRefs 暴露模板状态，方法使用 state.xxx，避免局部 orders/windows 等变量遮蔽响应式状态。
- 37 处原生复杂选择器迁移为明确的单类变体，保留动态状态；Web 单独保留优先级兼容规则。
- 跑马灯使用连续位移计时器，支持触摸暂停，页面隐藏/卸载清理。

## 代码规范复查

- 状态直接通过 reactive 对象或 ref 声明，不使用初始化 IIFE 包装；toRefs 仅用于保持模板解构后的响应性。
- 动态样式直接根据业务条件绑定，不通过拼接并反查类名字符串推断状态。
- 不使用 as any、@ts-ignore、@ts-nocheck 绕过页面及组件类型检查，也不添加虚假的 SDK 导出声明。
- 节点查询使用 DCloud 文档支持的 getCurrentInstance 与 createSelectorQuery().in() API。
- test-vapor 增加临时初始化包装、类型绕过和模板类名反查的回归检查。
- Node 逻辑测试隔离网络与生命周期依赖，仅用于行为回归；不代替官方编译器和原生运行验收。

## 验证

Node 测试：test-vapor、test-vapor-message、test-public-user-id、test-session-navigation、test-images、test-order-flow、test-pull-refresh、test-sales-ranking。setup-harness 使用真实 Vue reactive/toRefs/computed/watch 执行迁移后的代码；测试生命周期通过钩子注册表触发，不启动应用或提交真实业务请求。

已使用本机 HBuilderX 5.26 内置 uni-app 编译器进行 Web 构建，结果 DONE Build complete；在浏览器检查登录页、密码可见性切换、注册页跳转。后端不在线时验证码请求网络失败属于预期依赖状态，未执行真实登录、充值或支付。

该编译器的 uni-uts-v1 类型目录中 dcloudio__uni-app/types/index.d.ts 是空 module 声明，因此提示 onLoad/onShow 等导出声明警告。编译器的运行时模块具备这些导出，实际 Web 页面可以运行。没有修改 IDE 安装目录或用业务类型补丁掩盖警告。

原生蒸汽模式及新 HBuilder V 未在本机运行验收；Web 构建仍走 VDOM 是当前官方行为，不能当成原生 Vapor 构建通过。使用 HBuilder V 时直接打开本项目根目录，让 IDE 识别 manifest；若仍无运行项，需检查 V 的核心插件版本和运行环境。

## 官方依据

- https://doc.dcloud.net.cn/uni-app-x/app-vapor.html
- https://doc.dcloud.net.cn/uni-app-x/vue/index.html
- https://doc.dcloud.net.cn/uni-app-x/collocation/manifest.html
- https://doc.dcloud.net.cn/hbuilderv/differences/
