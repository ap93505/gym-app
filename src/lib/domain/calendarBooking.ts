export function calendarBookingInput(date: Date, allDay: boolean) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  // A month cell only specifies the day. Require an explicit bookable hour.
  return allDay ? `${local.slice(0, 10)}T` : local;
}
