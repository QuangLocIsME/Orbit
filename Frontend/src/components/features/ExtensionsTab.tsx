"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Extension {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  rating: number;
  installed: boolean;
  enabled: boolean;
  icon: "puzzle" | "sync" | "ai" | "export";
  iconColor: string;
}

const extensions: Extension[] = [
  {
    id: "1",
    name: "Auto Clash Detection",
    category: "Automation",
    description: "Automatically detect clashes and create BCF topics",
    version: "v2.1.0",
    rating: 4.8,
    installed: true,
    enabled: true,
    icon: "puzzle",
    iconColor: "bg-[#DBEAFE] text-[#2563EB]",
  },
  {
    id: "2",
    name: "Revit Sync",
    category: "Integration",
    description: "Real-time synchronization with Autodesk Revit",
    version: "v1.5.2",
    rating: 4.6,
    installed: true,
    enabled: false,
    icon: "sync",
    iconColor: "bg-[#D1FAE5] text-[#059669]",
  },
  {
    id: "3",
    name: "AI Model Checker",
    category: "AI/ML",
    description: "AI-powered model quality and compliance checking",
    version: "v0.9.1",
    rating: 4.5,
    installed: false,
    enabled: false,
    icon: "ai",
    iconColor: "bg-[#F3E8FF] text-[#7C3AED]",
  },
  {
    id: "4",
    name: "IFC Export Pro",
    category: "Export",
    description: "Advanced IFC export with custom property mapping",
    version: "v3.0.0",
    rating: 4.9,
    installed: false,
    enabled: false,
    icon: "puzzle",
    iconColor: "bg-[#DBEAFE] text-[#2563EB]",
  },
];

export default function ExtensionsTab() {
  const [activeFilter, setActiveFilter] = useState<"installed" | "marketplace">(
    "installed",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [extensionStates, setExtensionStates] = useState<
    Record<string, boolean>
  >(Object.fromEntries(extensions.map((e) => [e.id, e.enabled])));

  const filteredExtensions = extensions.filter((ext) => {
    const matchesFilter =
      activeFilter === "installed" ? ext.installed : !ext.installed;
    const matchesSearch =
      ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const toggleExtension = (id: string) => {
    setExtensionStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "puzzle":
        return (
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
            />
          </svg>
        );
      case "sync":
        return (
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case "ai":
        return (
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      case "export":
        return (
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="py-10 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Extensions</h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Browse Marketplace
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#101828] placeholder:text-[#99A1AF] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter("installed")}
            className={cn(
              "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
              activeFilter === "installed"
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50",
            )}
          >
            Installed
          </button>
          <button
            onClick={() => setActiveFilter("marketplace")}
            className={cn(
              "px-3 py-2 rounded-[10px] text-[12px] font-normal transition-colors",
              activeFilter === "marketplace"
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50",
            )}
          >
            Marketplace
          </button>
        </div>
      </div>

      {/* Extensions Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredExtensions.map((ext) => (
          <div
            key={ext.id}
            className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    ext.iconColor,
                  )}
                >
                  {getIcon(ext.icon)}
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-[#101828]">
                    {ext.name}
                  </h3>
                  <p className="text-[12px] text-[#6A7282]">{ext.category}</p>
                </div>
              </div>
              {ext.installed && (
                <button
                  onClick={() => toggleExtension(ext.id)}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    extensionStates[ext.id] ? "bg-[#22C55E]" : "bg-[#E5E7EB]",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      extensionStates[ext.id]
                        ? "translate-x-5"
                        : "translate-x-0",
                    )}
                  />
                </button>
              )}
            </div>

            {/* Description */}
            <p className="text-[13px] text-[#4A5565] mb-4 line-clamp-2">
              {ext.description}
            </p>

            {/* Version and Rating */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[12px] text-[#6A7282]">{ext.version}</span>
              <div className="flex items-center gap-1">
                <svg
                  className="h-4 w-4 text-[#FBBF24]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="text-[12px] text-[#6A7282]">{ext.rating}</span>
              </div>
            </div>

            {/* Action Button */}
            {ext.installed ? (
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white py-2.5 text-[14px] font-normal text-[#364153] hover:bg-gray-50 transition-colors">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Configure
              </button>
            ) : (
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#155DFC] py-2.5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Install
              </button>
            )}

            {/* Installed Badge */}
            {ext.installed && (
              <div className="mt-3">
                <span className="text-[12px] font-medium text-[#059669]">
                  Installed
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredExtensions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[#E5E7EB] bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F9FF] mb-4">
            <svg
              className="h-8 w-8 text-[#155DFC]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
              />
            </svg>
          </div>
          <h3 className="text-[16px] font-medium text-[#101828] mb-1">
            No extensions found
          </h3>
          <p className="text-[14px] text-[#6A7282] mb-4">
            {activeFilter === "installed"
              ? "Browse the marketplace to install extensions"
              : "No extensions match your search"}
          </p>
          <button
            onClick={() => setActiveFilter("marketplace")}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2.5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
          >
            Browse Marketplace
          </button>
        </div>
      )}
    </div>
  );
}
