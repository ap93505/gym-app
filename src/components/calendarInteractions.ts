"use client";

import { useRef, type RefObject, type TouchEvent } from "react";
import type FullCalendar from "@fullcalendar/react";
import type { FormatterInput } from "@fullcalendar/core";

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

export const calendarDayTitleFormat: FormatterInput = (arg) => {
  const { year, month, day } = arg.start;
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  return `${year}年${month + 1}月${day}日(${weekdays[weekday]})`;
};

export function useCalendarSwipe(calendarRef: RefObject<FullCalendar | null>) {
  const touch = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    const point = event.touches[0];
    const target = event.target as HTMLElement;
    touch.current = {
      x: point.clientX,
      y: point.clientY,
      blocked: !!target.closest(".fc-event, button, a, input, select, textarea, .draggable-pair"),
    };
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touch.current;
    touch.current = null;
    if (!start || start.blocked || !event.changedTouches[0]) return;
    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    const calendar = calendarRef.current?.getApi();
    if (deltaX > 0) calendar?.prev();
    else calendar?.next();
  }

  return { onTouchStart, onTouchEnd, onTouchCancel: () => { touch.current = null; } };
}
