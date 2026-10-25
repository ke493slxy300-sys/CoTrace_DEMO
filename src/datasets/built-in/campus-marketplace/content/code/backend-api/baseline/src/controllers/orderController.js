import { createOrder } from '../services/orderService.js';
import { BusinessError } from '../errors/BusinessError.js';

export async function createOrderController(req, res) {
  try {
    const order = await createOrder({
      itemId: req.body.itemId,
      buyerId: req.user.id
    });
    return res.status(201).json({ data: order });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(error.status).json({
        error: { code: error.code, message: error.message }
      });
    }
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '服务器暂时无法处理请求' }
    });
  }
}
