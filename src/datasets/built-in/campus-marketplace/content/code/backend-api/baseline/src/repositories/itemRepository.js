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
    return items.get(id) ?? null;
  },

  async update(id, patch) {
    const current = items.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    items.set(id, next);
    return next;
  },

  reset(seed) {
    items.clear();
    for (const item of seed) items.set(item.id, { ...item });
  }
};
