"use client";

const hours = Array.from({ length: 12 }, (_, index) => index + 10);

export function BookingDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [date = "", time = "10:00"] = value.split("T");
  const update = (nextDate: string, nextTime: string) => onChange(`${nextDate}T${nextTime}`);

  return (
    <div className="datetime-picker">
      <input
        className="input"
        type="date"
        aria-label="課程日期"
        value={date}
        onChange={(event) => update(event.target.value, time)}
        required
      />
      <select
        className="input"
        aria-label="課程開始時間"
        value={time}
        onChange={(event) => update(date, event.target.value)}
        required
      >
        {hours.map((hour) => <option value={`${String(hour).padStart(2, "0")}:00`} key={hour}>{hour}:00－{hour + 1}:00</option>)}
      </select>
    </div>
  );
}
