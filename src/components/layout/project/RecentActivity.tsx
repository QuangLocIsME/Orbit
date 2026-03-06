import React from "react";

type Activity = {
  id: string;
  text: string;
  time?: string;
};

type Props = {
  activities?: Activity[];
};

export default function RecentActivity({ activities = [] }: Props) {
  return (
    <section className="w-full bg-white border rounded-lg p-4 mb-6">
      <h3 className="text-lg font-medium mb-3">Recent activity</h3>
      <div className="flex flex-col gap-3">
        {activities.length === 0 && <div className="text-sm text-gray-500">No recent activity</div>}
        {activities.map((a) => (
          <div key={a.id} className="text-sm text-gray-700">
            <div className="text-sm">{a.text}</div>
            <div className="text-xs text-gray-500">{a.time}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
