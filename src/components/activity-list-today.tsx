"use client";

import { ActivityListSorted } from "./activity-list-sorted";
import { TodayTaskItem } from "./today-task-item";

interface Activity {
  id: string;
  content: string;
  status: string;
  mode: string;
  isUrgent?: boolean;
}

interface ActivityListTodayProps {
  activities: Activity[];
}

export function ActivityListToday({ activities }: ActivityListTodayProps) {
  return (
    <ActivityListSorted
      activities={activities}
      renderItem={(activity) => (
        <TodayTaskItem
          key={activity.id}
          id={activity.id}
          label={activity.content}
          isChecked={activity.status === "DONE" || activity.status === "COMPLETED"}
          mode={activity.mode}
          isUrgent={activity.isUrgent}
        />
      )}
    />
  );
}
