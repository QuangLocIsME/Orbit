import React from "react";

type Milestone = {
  id: string;
  title: string;
  due?: string;
  done?: boolean;
};

type Props = {
  milestones?: Milestone[];
};

export default function ProjectMilestones({ milestones = [] }: Props) {
  return (
    <section className="w-full bg-white border rounded-lg p-4 mb-6">
      <h3 className="text-lg font-medium mb-3">Milestones</h3>
      <div className="flex flex-col gap-3">
        {milestones.length === 0 && <div className="text-sm text-gray-500">No milestones</div>}
        {milestones.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${m.done ? "bg-green-500" : "bg-gray-300"}`} />
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-gray-500">{m.due}</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">{m.done ? "Done" : "Pending"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
