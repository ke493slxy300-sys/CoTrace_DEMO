const orders = new Map();

export const orderRepository = {
  async create(order) {
    orders.set(order.id, { ...order });
    return { ...order };
  },

  async findById(id) {
    return orders.get(id) ?? null;
  },

  reset() {
    orders.clear();
  }
};
