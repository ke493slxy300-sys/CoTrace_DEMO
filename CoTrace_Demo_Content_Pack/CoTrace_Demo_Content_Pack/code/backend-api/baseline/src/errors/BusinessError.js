export class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.status = status;
  }
}
