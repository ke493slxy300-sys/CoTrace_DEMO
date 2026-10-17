const items = new Map([
  ['item-1001', {
    id: 'item-1001',
    sellerId: 'user-alex',
    title: '二手机械键盘',
    price: 168,
    status: 'available'
  }]
]);

export const itemRepository = {
  async findById(id) {
    const item = items.get(id);
    return item ? { ...item } : null;
  },

  async updateIfStatus(id, expectedStatus, patch) {
    const current = items.get(id);
    if (!current || current.status !== expectedStatus) return null;
    const next = { ...current, ...patch };
    items.set(id, next);
    return { ...next };
  },

  async replace(item) {
    items.set(item.id, { ...item });
    return { ...item };
  },

  reset(seed) {
    items.clear();
    for (const item of seed) items.set(item.id, { ...item });
  }
};
