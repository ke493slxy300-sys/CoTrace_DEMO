export class BusinessError extends Error {
  constructor(message, code, status = 400, details = undefined) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
