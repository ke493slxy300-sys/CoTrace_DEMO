# 队友 A：前端页面节点

该节点演示商品详情页如何调用 Maya 负责的创建订单 API。代码重点展示加载状态、错误码映射、订单快照和人工范围判断。

队友 A 是演示代号，实际页面必须读取项目协作者快照中的前端负责人。

## 文件

- `src/pages/ItemDetailPage.jsx`
- `src/components/PurchasePanel.jsx`
- `src/components/OrderResultPanel.jsx`
- `src/services/orderApi.js`
- `src/utils/orderErrorMessages.js`
- `tests/PurchasePanel.test.jsx`

## 接口约定

调用 `POST /api/orders`，请求体只包含 `itemId`。买家身份由登录会话提供。
