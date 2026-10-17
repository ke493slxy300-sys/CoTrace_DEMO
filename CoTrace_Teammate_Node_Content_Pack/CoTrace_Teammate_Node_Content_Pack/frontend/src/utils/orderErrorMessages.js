const ORDER_ERROR_MESSAGES = {
  INVALID_ORDER_INPUT: '页面信息不完整，请刷新后重试。',
  ITEM_NOT_FOUND: '商品不存在或已被删除。',
  SELF_PURCHASE_NOT_ALLOWED: '不能购买自己发布的商品。',
  ITEM_NOT_AVAILABLE: '商品已被其他买家购买。',
  ORDER_CREATE_FAILED: '订单创建失败，请稍后重试。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试。'
};

export function getOrderErrorMessage(error) {
  return ORDER_ERROR_MESSAGES[error?.code] ?? ORDER_ERROR_MESSAGES.INTERNAL_ERROR;
}
