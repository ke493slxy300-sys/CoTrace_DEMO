# 订单 API 接口规范

版本：v1.0  
负责人：Maya Chen  
关联节点：后端 API  
状态：已提交

## 1. 创建订单

方法：`POST`  
路径：`/api/orders`

### 请求身份

买家身份由登录会话提供，不允许前端在请求体中指定任意 `buyerId`。

### 请求体

    {
      "itemId": "item-1001"
    }

### 成功响应

HTTP 201

    {
      "data": {
        "id": "order-generated-id",
        "itemId": "item-1001",
        "buyerId": "user-maya",
        "sellerId": "user-alex",
        "itemSnapshot": {
          "title": "二手机械键盘",
          "price": 168
        },
        "status": "pending_seller_confirmation",
        "createdAt": "2026-10-16T10:09:00.000Z"
      }
    }

## 2. 错误响应格式

    {
      "error": {
        "code": "ITEM_NOT_AVAILABLE",
        "message": "商品已不可购买",
        "details": {
          "currentStatus": "sold"
        }
      }
    }

## 3. 错误码

| HTTP | code | 含义 | 前端建议 |
|---|---|---|---|
| 400 | INVALID_ORDER_INPUT | 缺少商品或买家信息 | 检查页面状态后重试 |
| 404 | ITEM_NOT_FOUND | 商品不存在 | 提示商品不存在或已删除 |
| 409 | SELF_PURCHASE_NOT_ALLOWED | 用户购买自己的商品 | 提示不能购买自己的商品 |
| 409 | ITEM_NOT_AVAILABLE | 商品不可购买 | 提示商品已被其他买家购买 |
| 500 | ORDER_CREATE_FAILED | 订单写入失败 | 提示稍后重试 |
| 500 | INTERNAL_ERROR | 未识别服务错误 | 显示通用错误提示 |

## 4. 调用约束

- 前端操作键禁用只能改善体验，不能代替后端校验；
- 后端必须校验买家与卖家身份；
- 后端必须在写入时再次确认商品状态；
- 错误响应不得暴露堆栈和内部数据库信息；
- 前端不得仅根据错误消息文字判断类型，应使用 `code`。

## 5. 当前限制

- `sold` 当前表示停止接受新的购买申请，并不代表卖家已经最终确认；
- 内存仓储的补偿恢复不具备真实事务保证；
- 尚未实现订单查询、取消、确认和完成接口；
- 尚未实现重复请求标识。
