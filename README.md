# 校园食堂 · 学生端

面向高校食堂场景的学生（`CUSTOMER`）移动点餐应用。学生可以浏览食堂档口、点餐、用账户余额支付、查看订单与取餐码、评价菜品与档口、参与排行榜、接收通知与商家聊天、领取优惠券、管理个人账户。

- 技术形态：uni-app x（`.uvue` / `.uts`）+ Vue 3 组合式 API
- 运行目标：Web 浏览器预览、Android 真机（主力）
- 管理端边界：本仓库**只承载学生功能**。店主、餐厅经理、总经理、系统管理员等角色的页面与操作在独立的 Vue 管理端仓库，不在本工程内实现（见 [AGENTS.md](AGENTS.md)）

> 本文档面向开发与联调。界面与交互的详细约定见 [DESIGN.md](DESIGN.md)、[UX-CONTRACT.md](UX-CONTRACT.md)；评价模块见 [COMMENT_INTEGRATION.md](COMMENT_INTEGRATION.md)；蒸汽模式迁移记录见 [VAPOR_MIGRATION.md](VAPOR_MIGRATION.md)。

---

## 一、技术栈

| 类别 | 选型 | 说明 |
|---|---|---|
| 应用框架 | uni-app x | 页面使用 `.uvue`，逻辑使用 `.uts`（TypeScript 方言） |
| 视图层 | Vue 3 `script setup` | 全部页面与组件为组合式 API，不使用 Options API |
| 渲染模式 | Vapor + 样式隔离 2.0 | `manifest.json` 中 `uni-app-x.vapor = true`；Web 端仍为 VDOM |
| 开发工具 | HBuilderX 5.26+ | 工程无 `package.json`，不使用 npm 构建，必须通过 HBuilderX 编译运行 |
| 网络 | `uni.request` 封装 | 统一响应体、Bearer 令牌、401 单飞续期、文件上传 |
| 实时 | WebSocket | 通知/聊天通过 notification-service 的 WS 连接；另有轮询兜底 |
| 本地存储 | `uni.setStorageSync` | 访问令牌、刷新令牌、记住账号、待确认请求快照等 |
| 样式 | 原生 CSS + 共享样式文件 | 品牌色与账户/订单/评价/客服四套业务样式 |

---

## 二、功能模块

| 模块 | 页面 | 主要能力 |
|---|---|---|
| 登录注册 | `login`、`register`、`email-verification`、`password-recovery` | 账号密码登录、图片验证码、邮箱注册与验证、忘记密码、记住账号 |
| 首页 | `home` | 餐厅/档口列表、档口月售汇总、首页公告、推荐位、搜索入口、下拉刷新 |
| 点餐 | `menu`、`search` | 档口菜单与分类联动、购物车、库存提示、菜品/档口评分、菜品搜索与历史 |
| 下单 | `order/confirm` | 购物车确认、备注、预估金额、创建订单（幂等键） |
| 订单与支付 | `order/list`、`order/detail`、`order/refunds` | 订单筛选与分页、余额支付、支付密码、取餐码与二维码、取消、退款申请/撤回/申诉 |
| 钱包 | `wallet/recharge`、`wallet/records`、`wallet/payment-password` | 余额充值（模拟）、流水（充/支/退）、支付密码设置与找回 |
| 优惠券 | `coupons/list` | 可领取优惠券、我的优惠券 |
| 收藏 | `favorites/list` | 收藏档口与菜品，批量查询收藏状态 |
| 评价 | `review/list`、`review/create`、`review/discussions` | 订单完成后店铺评价、菜品评价、评论/回复/编辑/撤回 |
| 排行榜 | `ranking` | 全站菜品累计销量 TOP 50，可跳转所属档口 |
| 消息 | `notifications/list`、`notifications/orders`、`notifications/preferences`、`notifications/chat` | 系统通知、订单通知、免打扰偏好、未读数、与商家聊天 |
| 个人中心 | `mine` | 身份卡、订单快捷入口、钱包/账号/帮助分组入口 |
| 账号资料 | `account/profile`、`change-password`、`email-change`、`pay-password` 等 | 头像与昵称、登录密码修改、邮箱换绑、支付密码、注销账号（72 小时冷静期） |
| 客服工单 | `support/list`、`support/submit`、`support/detail` | 提交工单、追加消息、查看进度、关闭工单 |
| 关于与协议 | `about/about`、`about/legal` | 产品信息、用户协议与隐私说明 |

底部导航四项：**首页、排行榜、消息、我的**。

---

## 三、页面路由

路由定义在 [pages.json](pages.json)，全部使用自定义导航栏。首个页面为登录页。

| 路径 | 说明 |
|---|---|
| `pages/login/login` | 登录（用户号或邮箱 + 密码 + 图片验证码） |
| `pages/register/register` | 注册（昵称、邮箱、密码，注册成功展示用户号） |
| `pages/home/home` | 首页（tab） |
| `pages/ranking/ranking` | 排行榜（tab） |
| `pages/notifications/list` | 消息中心（tab） |
| `pages/mine/mine` | 我的（tab） |
| `pages/menu/menu` | 档口点餐 |
| `pages/search/search` | 菜品搜索 |
| `pages/order/confirm` | 确认订单 |
| `pages/order/list` | 我的订单（按状态筛选） |
| `pages/order/detail` | 订单详情、支付、取餐码 |
| `pages/order/refunds` | 退款记录与操作 |
| `pages/wallet/recharge` | 余额充值 |
| `pages/wallet/records` | 资金流水 |
| `pages/wallet/payment-password` | 支付密码设置/修改入口 |
| `pages/coupons/list` | 优惠券 |
| `pages/favorites/list` | 收藏 |
| `pages/review/list` | 我的评价 |
| `pages/review/create` | 发表评价 |
| `pages/review/discussions` | 评价讨论 |
| `pages/notifications/orders` | 订单通知 |
| `pages/notifications/preferences` | 通知偏好 |
| `pages/notifications/chat` | 订单聊天 |
| `pages/account/profile` | 个人资料（头像、昵称、邮箱、用户号） |
| `pages/account/change-password` | 修改登录密码 |
| `pages/account/email-change` | 邮箱换绑（密码 + 图形验证码 + 邮件验证码） |
| `pages/account/email-verification` | 历史账号邮箱补验 |
| `pages/account/pay-password` | 设置/修改支付密码 |
| `pages/account/pay-password-recovery` | 支付密码找回 |
| `pages/account/password-recovery` | 登录密码找回 |
| `pages/account/account-deletion` | 申请注销账号 |
| `pages/account/deletion-pending` | 注销冷静期（可撤回） |
| `pages/support/list` | 客服工单列表 |
| `pages/support/submit` | 提交工单 |
| `pages/support/detail` | 工单详情与会话 |
| `pages/about/about` | 关于 |
| `pages/about/legal` | 协议与隐私 |

---

## 四、目录结构

```text
order_system_cloud_user/
├─ App.uvue                 # 根组件与 App 生命周期（前台通知连接、Android 双击退出）
├─ main.uts                 # createApp 入口
├─ pages.json               # 页面与 tabBar 配置
├─ manifest.json            # 应用名称、版本、uni-app x / Vapor / 小程序配置
├─ index.html               # H5 入口模板
├─ uni.scss                 # 全局 SCSS 变量
├─ pages/                   # 页面（按业务分目录）
├─ components/              # 复用组件
│  ├─ business-image/       # 业务图片：解析文件地址、失败回退默认图
│  ├─ confirm-dialog/       # 页内确认对话框（不依赖浏览器原生弹窗）
│  ├─ refresh-header/       # 下拉刷新头部（含本次刷新时间）
│  ├─ review-list/          # 评价列表
│  ├─ review-stars/         # 星级展示与输入
│  └─ window-message/       # 档口公告跑马灯
├─ api/                     # 按后端域拆分的接口封装（auth/users/products/orders/...）
├─ common/                  # 基础设施与业务公共逻辑（见下表）
├─ store/                   # 全局状态
│  ├─ auth.uts              # 登录态、令牌落盘、角色校验、注销会话
│  └─ notifications.uts     # 通知/聊天 WebSocket、未读数、重连与监听分发
├─ styles/                  # 业务共享样式：account / order / review / support
├─ static/                  # tabBar 图标、默认图、业务插图
├─ scripts/                 # 本地验证脚本与 Android 无线调试辅助脚本
└─ unpackage/               # HBuilderX 编译产物（已 gitignore）
```

`common/` 关键文件：

| 文件 | 职责 |
|---|---|
| `config.uts` | 唯一的接口地址、超时、成功码配置 |
| `http.uts` | 统一请求层：拼地址、注入令牌、解析统一响应体、401 续期、文件上传 |
| `storage.uts` | 令牌/记住账号读写、会话版本号、退出中标记 |
| `jwt.uts` | JWT 载荷解析（读取角色、用户 UUID 等，不校验签名） |
| `refresh.uts` | 下拉刷新最短 1.2 秒与刷新时间文案 |
| `feedback.uts` | Toast 等操作反馈封装 |
| `images.uts` / `image-picker.uts` / `save-image.uts` | 图片地址解析、系统相册选择与大小校验、保存图片 |
| `checkout.uts` | 待确认下单快照与幂等键复用 |
| `order-live.uts` | 订单页订阅通知变化后合并刷新 |
| `order-countdown.uts` | 订单倒计时文案统一生成 |
| `order-navigation.uts` | 订单状态入口与筛选参数统一导航 |
| `comments.uts` | 待确认评价/评论快照与幂等键 |
| `chat-local.uts` | 聊天本地缓存与待确认消息 |
| `email-ownership-session.uts` / `email-change-session.uts` | 邮箱补验/换绑的短时授权凭据（仅内存，不落盘、不进路由） |
| `payment-password.uts` | 支付密码相关规则与清理 |
| `legal.uts` / `account.uts` / `search-history.uts` | 协议文本、账户页返回、搜索历史 |

---

## 五、后端依赖与接口约定

### 5.1 请求链路

```text
学生端 → Nginx(8088) /api → Spring Cloud Gateway(9090) → 各微服务
```

学生端不直接访问网关或微服务，统一走 `API_BASE_URL`（默认 `http://localhost:8088/api`）。

### 5.2 接口前缀与后端服务

| 前端前缀 | 后端服务 | 学生端用途 |
|---|---|---|
| `/api/auth` | auth-service | 验证码、登录、注册、邮箱验证、密码重置、令牌续期 |
| `/api/users` | user-service | 资料、头像绑定、余额、充值、支付密码、邮箱换绑、注销 |
| `/api/products` | product-service | 餐厅、档口、菜单、公告、库存快照查询 |
| `/api/cart` | cart-service | 购物车增删改查、下单后按版本清理 |
| `/api/orders` | order-service | 订单创建/列表/详情/取消、取餐码、退款 |
| `/api/payments` | payment-service | 余额支付、支付结果查询 |
| `/api/coupons` | coupon-service | 可领取优惠券、我的优惠券 |
| `/api/comments` | comment-service | 菜品评价、档口评价、评论与讨论 |
| `/api/statistics` | statistics-service | 月售汇总、销量排行榜 |
| `/api/search` | search-service | 菜品搜索 |
| `/api/recommendations` | recommendation-service | 首页推荐 |
| `/api/notifications`、`/api/chat` | notification-service | 通知、免打扰、聊天、WebSocket |
| `/api/support` | support-service | 客服工单与会话 |
| `/api/files` | file-service | 图片上传与内容读取 |

### 5.3 统一响应与错误处理

- 后端响应体固定为 `{ code, message, data }`，成功码为字符串 `COMMON_000`（定义在 `common/config.uts` 的 `SUCCESS_CODE`）。
- `common/http.uts` **不抛异常**，统一返回 `HttpResult { ok, message, data, statusCode }`；页面只判断 `ok`。
- 常见状态码提示：`401` 登录失效、`403` 无权限、`429` 操作过于频繁。
- 创建订单、充值、评价、工单、退款等写操作携带 `Idempotency-Key`，网络失败可安全重试。

### 5.4 登录态与令牌

- 登录账号是 **10 位用户号**或**注册邮箱**；昵称仅用于展示，不能用于登录。
- 登录成功后保存 `access_token` 与 `refresh_token`；「记住账号」只保存用户号/邮箱，不保存密码。
- 任一鉴权请求返回 `401` 时，请求层先做一次刷新再重试原请求；并发 401 **合并为一次刷新**（单飞），刷新失败则清理会话并提示重新登录。
- 退出登录会递增会话版本号并标记“退出中”，避免退出过程中的迟到响应重新写回登录态。
- 登录页与 `store/auth.uts` 只接受 `CUSTOMER`；其他角色请使用管理端。

---

## 六、快速开始

### 6.1 前置条件

1. **HBuilderX 5.26 或以上**（含 uni-app x / UTS 编译环境），用于运行与打包。
2. **Node.js 18+**：仅用于运行 `scripts/` 下的本地验证脚本，不参与应用构建。
3. **后端环境**：MySQL、Redis、Nacos、网关与 Nginx（8088）。基础设施如何启动见后端仓库 README。
4. **Android 真机（可选）**：手机与电脑同一局域网，开启无线调试。

本工程没有 `package.json`，**不需要也不应该执行 `npm install` / `npm run dev`**。

### 6.2 启动后端

在后端仓库 `order_system_cloud` 中：

```powershell
# 基础设施（MySQL / Redis / Nacos / Seata）
docker compose up -d mysql redis nacos seata

# Nginx 边缘入口（8088）
docker compose --profile edge up -d
```

然后启动网关与所需业务服务，确认 `http://localhost:8088/api/...` 可访问。学生端常用服务包括 auth、user、product、cart、order、payment、file、comment、statistics、notification、support。

### 6.3 配置接口地址

只改 [common/config.uts](common/config.uts)：

```ts
// Web / 微信开发者工具：本机 Nginx
let apiBaseUrl = 'http://localhost:8088/api'

// #ifdef APP-ANDROID
// Android 真机：电脑的局域网地址（换网络后需同步修改）
apiBaseUrl = 'http://192.168.0.14:8088/api'
// #endif
```

要点：

- 地址必须以 `/api` 结尾，后面不要再拼服务名。
- 不要在其他文件硬编码地址、超时或成功码。
- Android 默认走局域网直连，避免无线调试重连后 ADB 转发失效；请把 `192.168.0.14` 换成你电脑当前 IP，并放行防火墙 8088 端口。

### 6.4 运行

**Web（浏览器预览）**

1. 用 HBuilderX 打开本工程目录。
2. 菜单「运行 → 运行到浏览器 → Chrome」。
3. 浏览器访问的是 HBuilderX 提供的预览端口，不是 8088；接口仍由 `apiBaseUrl` 指向 8088。

**Android 真机**

1. 手机开启「无线调试」，记下屏幕上的 `IP:端口`（不是配对端口）。
2. 可选：先连接设备并建立 8088 反向转发：

```powershell
scripts\connect-android.cmd 192.168.0.14:37000
```

3. 在 HBuilderX 中「运行 → 运行到手机或模拟器」，选择该设备。
4. 若配置使用局域网 IP 直连，`adb reverse` 不是必需；但设备仍需要通过 ADB 被 HBuilderX 识别。

**微信小程序（非主力）**

`manifest.json` 中的微信 `appid` 为空，需自行填写；开发者工具中勾选「不校验合法域名」后才能访问本地接口。当前验收重点是 Web 与 Android。

### 6.5 登录与账号

- 学生账号通过注册页创建，注册需要完成邮箱验证；也可使用团队本机的私有测试账号（密码不写入 Git）。
- 登录必须填写图片验证码，验证码由后端 Base64 下发。
- 历史账号若邮箱未验证，登录会返回 `emailVerificationRequired`，前端跳转 `pages/account/email-verification` 完成补验。
- 管理员、店主、经理等非 `CUSTOMER` 账号不能进入本应用。

---

## 七、关键实现约定

### 7.1 下拉刷新

- 所有页面使用原生 `scroll-view` 的 `refresher-*` 能力，不提供“刷新/重试”按钮。
- 刷新动画最短展示 1200ms，统一由 `refresh-header` 组件呈现；刷新时间只在 refresher 插槽显示，结束即收起。
- 失败保留旧数据并提示具体原因；支付、充值、提交过程中禁止并发刷新。

### 7.2 图片

- 统一通过 `business-image` 组件展示业务图片：解析文件服务地址，加载失败回退本地默认图（头像/档口/菜品）。
- 选图统一走 `common/image-picker.uts`（系统相册、单图、5MB 校验）。
- 上传走 `common/http.uts` 的 `uploadFile`，目标为 `/api/files/upload`；头像绑定走 `/api/users/me/avatar`。
- 学生端只保留头像、评价、反馈类图片上传；档口封面与菜品图片由管理端维护。

### 7.3 通知与聊天

- `store/notifications.uts` 在 App 前台启动共享 WebSocket 会话：先取 `socket-ticket`，再建立连接；断线退避重连，并用未读数轮询兜底。
- 订单页通过 `common/order-live.uts` 订阅通知变化，合并连续推送后刷新一次，避免重复请求。
- 聊天消息带本地幂等键与 ACK 超时；超时按“结果未确认”处理，可用原键安全重试。

### 7.4 样式与跨端

- 品牌主色 `#E4572E`，页面底色 `#FDF6F0`；账户、订单、评价、客服样式分别在 `styles/*.css`。
- 页面私有样式留在各 `.uvue` 内；共享业务样式放 `styles/`。
- 原生端只使用单类/分组选择器（Vapor 样式隔离 2.0），Web 专属选择器写在 `WEB` 条件编译区。
- 页面与组件生命周期使用 `onPageShow` / `onPageHide` 等组合式钩子。

---

## 八、本地验证脚本

`scripts/` 下是一套 **Node.js 轻量验证脚本**，不是完整测试框架，也没有覆盖率统计：

- 运行方式：在工程根目录执行单个脚本，例如

```powershell
node scripts/test-comments.cjs
node scripts/test-order-flow.cjs
node scripts/test-logout-races.cjs
```

- 脚本通过 `D:/HBuilderX/plugins/...` 下的 TypeScript / Vue 依赖直接转译 `.uts`，并用 `node:assert` 断言。**如果 HBuilderX 装在别的路径，需要先修改脚本内的绝对路径**（或修改 `scripts/setup-harness.cjs`）。
- 覆盖范围示例：登录/注销竞态、令牌续期、订单流程与分页、取餐码、倒计时、评价与评论、通知会话、聊天、搜索、下拉刷新、收藏、退款、客服、支付密码、邮箱流程等。
- 这些脚本验证的是业务逻辑与状态机，**不能替代** HBuilderX 编译、Web 构建、浏览器交互和真机验收。

Android 辅助脚本：

- `scripts/connect-android.cmd`：连接无线调试设备并为 8088 建立反向转发（内部调用 `connect-android.ps1`）。
- `scripts/stop-android-waits.ps1`、`scripts/清理HBuilderV无线等待进程.cmd`：清理卡住的 ADB/HBuilder 等待进程。

---

## 九、常见问题

**1. 浏览器能打开页面，但所有接口失败**

确认后端 Nginx 已启动（`http://localhost:8088/api/...`），且 `common/config.uts` 的 `apiBaseUrl` 与本机环境一致。

**2. 手机提示网络异常**

- 手机与电脑是否同一局域网；
- Android 分支地址是否改成了电脑当前 IP；
- Windows 防火墙是否放行 8088；
- 若改用 `localhost`，是否已执行 `adb reverse tcp:8088 tcp:8088`。

**3. 登录提示“账号或密码错误”**

- 使用用户号或邮箱，不要用昵称；
- 检查图片验证码是否过期（过期会返回验证失败）；
- 连续失败会触发限流，稍后再试。

**4. 登录后提示需要验证邮箱**

说明账号 `email_verified_at` 为空。按页面引导完成邮箱补验；非学生账号应去管理端处理。

**5. 图片不显示**

检查文件服务是否可用、图片地址是否为 `/api/files/...` 相对路径；加载失败时 `business-image` 会回退默认图，可先看默认图是否出现。

**6. 8088 和 9090 有什么区别**

- `9090` 是网关直连端口；
- `8088` 是 Nginx 对外入口，负责学生端静态资源与 `/api` 转发，学生端默认使用 8088。

**7. HBuilderX 运行报 UTS/uvue 编译错误**

确认 HBuilderX 版本 ≥ 5.26，并已安装 uni-app x 编译插件；不要用 npm/Vite 直接运行 `.uvue` 工程。

---

## 十、相关仓库

| 仓库 | 说明 |
|---|---|
| `order_system_cloud` | 后端多模块工程：网关、15 个微服务、数据库迁移、Nacos 配置、Nginx 与基础设施 |
| `order_system_cloud_user` | 本仓库，学生端（uni-app x，仅 CUSTOMER） |
| `oreder_sys_cloud_admin` | Vue 3 + Vite 管理端，承载店主/经理/总经理/系统管理员功能 |

---

## 十一、已知限制与未验证项

- Web（VDOM）构建与主要交互已验证；**Android / iOS / 鸿蒙原生端尚未完成全面验收**，真机问题需结合 HBuilderX 日志排查。
- 充值为本地模拟能力，不接入真实支付渠道；余额与流水由后端同库事务保证。
- Android 默认接口地址是硬编码的局域网 IP，换网络后必须手动修改。
- 微信/支付宝等小程序 `appid` 未配置，不是当前主力目标。
- `scripts/` 验证脚本依赖本机 HBuilderX 安装路径，换机后需调整。
- 本项目没有 npm 脚本，构建、运行、打包统一以 HBuilderX 为准。
