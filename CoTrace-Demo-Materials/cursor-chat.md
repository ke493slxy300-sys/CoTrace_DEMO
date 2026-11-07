# 订单创建服务交付
> 模拟 Cursor Markdown 导出，CoTrace 测试素材。

_Exported from Cursor (simulated)_

---

**User**

[C01] 我在整理 v0.4 的交付。已售出时应当让前端收到什么？

**Cursor**

[C02] 建议返回 409 和 ITEM_NOT_AVAILABLE，避免前端将商品不可购买当成通用请求失败。

**User**

[C03] 采用这个约定。我已在 createOrder 加入可售状态检查，商品不可售时返回 409 / ITEM_NOT_AVAILABLE。前端约定提示「暂时无法购买」，还没联调。

**Cursor**

[C04] 可把错误码与前端文案的对应关系写入交付。服务层结果以实际测试输出为依据，前端提示留作接手后核对。
