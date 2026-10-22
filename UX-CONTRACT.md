# 账户中心交互约定

中文 zh-CN，面向校园用户，uni-app x / UTS，手机优先并兼容 Web。资金功能按用户要求为模拟充值，无真实外部收款。

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | styles/account.css；api/wallet.uts | 后端 RechargeRequest、PayPasswordSetRequest | 充值、首次设置/修改支付密码 | 静态语法与契约核对；运行验证待进行 |
| Toast | common/feedback.uts | 现有 uni.showToast 封装；重要错误保留在页面 | 普通、成功 | 复用现有封装 |
| CRUD | common/http.uts；api/wallet.uts；pages.json | 后端 WALLET_API.md | 当前用户查询、幂等充值、支付密码设置 | 路由、参数、重试键静态核对 |
| Scrollbar | 原生 scroll-view；styles/account.css | DESIGN.md | 账户中心、资料、充值、记录、密码 | 模板及样式路径检查；真机待验证 |

## 统一规则

- “我的”是分组入口，个人资料另页展示，避免后续信息都堆在首页。
- 无请求结果时余额显示 `--`，加载、错误、重试和空记录都有明确文案。
- 充值使用普通业务文案；未设置支付密码先设置。密码使用掩码输入，不存储、不写 URL，离开页面清空。
- 未确认充值保留同一请求键及金额，成功才清除；业务明确拒绝可重新填写。后端余额和流水在同一事务提交。
- 查询仅从 JWT 定位本人，支付密码和余额入口仅对 CUSTOMER 展示。
- 流水按 ID 倒序游标加载，切换筛选时重置游标，加载中防止重复请求。
- 页面返回使用 common/account.uts 的 backToAccount，无上级页面时回“我的”。
- 按钮用原生 button，图标按钮带 aria-label；退出登录用页内二次确认，不引入浏览器原生弹窗。
- 禁止把静态语法检查称为单元测试或真机验证；不运行 Maven。

## 订单提交

- API 复用 orders、payments 和 cart/orders/{orderId}/cleanup；状态使用后端中文订单状态及支付英文状态。
- 以当前用户隔离待确认请求；发送前保存原始菜品、数量、备注与幂等键，网络失败继续使用同一请求。待确认期间锁定备注与菜品。
- 订单创建和支付是两个步骤。只有支付服务返回 SUCCESS 才认为扣款已确认，订单最终展示以查询接口为准。
- 订单成功后调用按 revision 清理接口，不清空整个窗口；失败保留原快照，详情页重试，订单成功不因清理失败而回滚展示。
- 支付密码不落盘、不写路由，离开详情页清空。取消前页内确认；本次支付未确认时禁止取消。
- 确认页、列表和详情都显示加载/失败/空状态，订单详情不依赖本地购物车恢复。
