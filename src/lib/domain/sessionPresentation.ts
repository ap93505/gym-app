export const sessionStatusLabels: Record<string, string> = {
  scheduled: "已預約",
  checked_in: "已報到",
  completed: "已完成",
  not_completed: "未完成",
  cancelled: "已取消",
};

export const sessionStatusColors: Record<string, string> = {
  scheduled: "#4f8fb3",
  checked_in: "#d69b35",
  completed: "#71817a",
  not_completed: "#c75b5b",
  cancelled: "#806d86",
};

export function sessionStatusColor(status: string) {
  return sessionStatusColors[status] ?? "#6d8579";
}
