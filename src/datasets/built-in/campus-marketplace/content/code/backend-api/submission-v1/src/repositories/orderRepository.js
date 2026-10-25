const orders = new Map();

export const orderRepository = {
  async create(order) {
    orders.set(order.id, { ...order });
    return { ...order };
  },

  async findById(id) {
    const order = orders.get(id);
    return order ? { ...order } : null;
  },

  async delete(id) {
    return orders.delete(id);
  },

  reset() {
    orders.clear();
  }
};
