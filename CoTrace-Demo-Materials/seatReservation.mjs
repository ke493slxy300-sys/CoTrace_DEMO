export function reserveSeat(seat) {
  return seat.occupied ? { status: 409, code: 'SEAT_OCCUPIED' } : { status: 201 };
}
