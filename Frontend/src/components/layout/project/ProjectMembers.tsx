import React from "react";

type Member = {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
};

type Props = {
  members?: Member[];
};

export default function ProjectMembers({ members = [] }: Props) {
  return (
    <section className="w-full bg-white border rounded-lg p-4 mb-6">
      <h3 className="text-lg font-medium mb-3">Members</h3>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 bg-gray-50 border rounded-lg px-3 py-2">
            <img src={m.avatar ?? "/images/avatar-placeholder.png"} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
            <div className="text-sm">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-gray-500">{m.role}</div>
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="text-sm text-gray-500">No members</div>}
      </div>
    </section>
  );
}
