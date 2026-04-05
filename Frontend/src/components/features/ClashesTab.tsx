'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Clash {
  id: number;
  status: 'open' | 'in-progress' | 'resolved' | 'new' | 'active';
  type: 'Hard Clash' | 'Soft Clash';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  location: string;
  models: string[];
  assignedTo: string;
  distance?: string;
  element1?: { name: string; category: string; file: string };
  element2?: { name: string; category: string; file: string };
}

interface ClashGroup {
  id: string;
  name: string;
  count: number;
  items: Clash[];
}

const clashesData: Clash[] = [
  {
    id: 1,
    status: 'open',
    type: 'Hard Clash',
    severity: 'critical',
    title: 'HVAC duct intersects with structural beam',
    location: 'Floor 3, Grid C-4',
    models: ['MEP_HVAC_System.dwg', 'Structure_Beams_Columns.ifc'],
    assignedTo: 'Tuấn Kiệt',
  },
  {
    id: 2,
    status: 'in-progress',
    type: 'Hard Clash',
    severity: 'high',
    title: 'Plumbing pipe conflicts with electrical conduit',
    location: 'Floor 2, Grid B-3',
    models: ['MEP_Plumbing.dwg', 'MEP_Electrical.dwg'],
    assignedTo: 'Thu Trang',
  },
  {
    id: 3,
    status: 'resolved',
    type: 'Soft Clash',
    severity: 'medium',
    title: 'Clearance issue between facade and HVAC unit',
    location: 'Floor 1, Lobby',
    models: ['Architecture_Facade.rvt', 'MEP_HVAC_System.dwg'],
    assignedTo: 'Minh Anh',
  },
  {
    id: 4,
    status: 'open',
    type: 'Hard Clash',
    severity: 'high',
    title: 'Steel column penetrates through ductwork',
    location: 'Floor 4, Grid D-5',
    models: ['Structure_Columns.ifc', 'MEP_HVAC_System.dwg'],
    assignedTo: 'Hoàng Nam',
  },
  {
    id: 5,
    status: 'in-progress',
    type: 'Soft Clash',
    severity: 'medium',
    title: 'Fire sprinkler head too close to ceiling diffuser',
    location: 'Floor 2, Conference Room',
    models: ['MEP_Fire.dwg', 'MEP_HVAC_System.dwg'],
    assignedTo: 'Thu Trang',
  },
];

// Detection view clash groups
const clashGroups: ClashGroup[] = [
  {
    id: 'structure-mep',
    name: 'Structure vs MEP',
    count: 2,
    items: [
      {
        id: 1,
        status: 'new',
        type: 'Hard Clash',
        severity: 'critical',
        title: 'Beam-Column vs HVAC Duct',
        location: '',
        distance: '0.15 m',
        models: [],
        assignedTo: 'Tuấn Kiệt',
        element1: { name: 'Structural Framing: W24x84', category: 'Structure', file: 'Structure_Beams_Columns.rvt' },
        element2: { name: 'Rectangular Duct: 600x400mm', category: 'MEP - HVAC', file: 'MEP_HVAC_System.rvt' },
      },
      {
        id: 2,
        status: 'active',
        type: 'Hard Clash',
        severity: 'high',
        title: 'Column vs Pipe',
        location: '',
        distance: '0.08 m',
        models: [],
        assignedTo: 'Thu Trang',
        element1: { name: 'Structural Column: C350x350', category: 'Structure', file: 'Structure_Columns.rvt' },
        element2: { name: 'Pipe: DN100', category: 'MEP - Plumbing', file: 'MEP_Plumbing.rvt' },
      },
    ],
  },
  {
    id: 'architecture-mep',
    name: 'Architecture vs MEP',
    count: 1,
    items: [
      {
        id: 3,
        status: 'new',
        type: 'Soft Clash',
        severity: 'medium',
        title: 'Wall vs Duct',
        location: '',
        distance: '0.05 m',
        models: [],
        assignedTo: 'Minh Anh',
        element1: { name: 'Basic Wall: 200mm', category: 'Architecture', file: 'Architecture_Walls.rvt' },
        element2: { name: 'Rectangular Duct: 400x300mm', category: 'MEP - HVAC', file: 'MEP_HVAC_System.rvt' },
      },
    ],
  },
  {
    id: 'mep-internal',
    name: 'MEP Internal',
    count: 1,
    items: [
      {
        id: 4,
        status: 'resolved',
        type: 'Soft Clash',
        severity: 'low',
        title: 'Duct vs Cable Tray',
        location: '',
        distance: '0.03 m',
        models: [],
        assignedTo: 'Hoàng Nam',
        element1: { name: 'Rectangular Duct: 300x200mm', category: 'MEP - HVAC', file: 'MEP_HVAC_System.rvt' },
        element2: { name: 'Cable Tray: 300mm', category: 'MEP - Electrical', file: 'MEP_Electrical.rvt' },
      },
    ],
  },
];

const statusConfig = {
  open: { label: 'open', bg: 'bg-[#FFF1F2]', color: 'text-[#C70036]' },
  'in-progress': { label: 'in-progress', bg: 'bg-[#FEF3C7]', color: 'text-[#B45309]' },
  resolved: { label: 'resolved', bg: 'bg-[#D1FAE5]', color: 'text-[#059669]' },
  new: { label: 'New', bg: 'bg-[#10B981]', color: 'text-white' },
  active: { label: 'Active', bg: 'bg-[#F59E0B]', color: 'text-white' },
};

const severityConfig = {
  critical: { label: 'CRITICAL', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  high: { label: 'high', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  medium: { label: 'medium', bg: 'bg-[#FFF7ED]', color: 'text-[#C2410C]' },
  low: { label: 'low', bg: 'bg-[#F0FDF4]', color: 'text-[#16A34A]' },
};

const iconColors = {
  open: 'text-[#0084D1] bg-[#F0F9FF]',
  'in-progress': 'text-[#F59E0B] bg-[#FEF3C7]',
  resolved: 'text-[#10B981] bg-[#D1FAE5]',
  new: 'text-[#DC2626] bg-[#FEF2F2]',
  active: 'text-[#F59E0B] bg-[#FEF3C7]',
};

export default function ClashesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'high' | 'medium'>('all');
  const [isDetectionView, setIsDetectionView] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('split');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['structure-mep']);
  const [selectedClash, setSelectedClash] = useState<Clash | null>(clashGroups[0].items[0]);

  // Calculate stats
  const totalClashes = clashesData.length;
  const highSeverity = clashesData.filter(c => c.severity === 'critical' || c.severity === 'high').length;
  const inProgress = clashesData.filter(c => c.status === 'in-progress').length;
  const resolved = clashesData.filter(c => c.status === 'resolved').length;

  // Detection view stats
  const detectionTotal = clashGroups.reduce((acc, g) => acc + g.count, 0);
  const detectionNew = clashGroups.reduce((acc, g) => acc + g.items.filter(i => i.status === 'new').length, 0);
  const detectionResolved = clashGroups.reduce((acc, g) => acc + g.items.filter(i => i.status === 'resolved').length, 0);

  // Filter clashes
  const filteredClashes = clashesData.filter(clash => {
    const matchesSearch = clash.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          clash.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'high') return matchesSearch && (clash.severity === 'critical' || clash.severity === 'high');
    if (filterType === 'medium') return matchesSearch && clash.severity === 'medium';
    return matchesSearch;
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Detection Results View
  if (isDetectionView) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] -mx-[300px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-white border-b-2 border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Run Test Button */}
            <button 
              onClick={() => setIsDetectionView(false)}
              className="inline-flex items-center gap-2 rounded bg-[#155DFC] px-3 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Run Test
            </button>

            {/* Export Report Button */}
            <button className="inline-flex items-center gap-2 rounded border border-[#D1D5DC] bg-white px-3 py-2 text-sm text-[#364153] hover:bg-gray-50 transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-[#D1D5DC]" />

            {/* View Mode Toggle */}
            <div className="flex items-center rounded bg-[#F3F4F6] p-0.5">
              <button
                onClick={() => setViewMode('2d')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === '2d' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                2D
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === '3d' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                3D
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  viewMode === 'split' ? "bg-white shadow-sm text-[#101828]" : "text-[#4A5565]"
                )}
              >
                Split
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#4A5565]">Total: <span className="text-[#101828] font-medium">{detectionTotal}</span></span>
            <span className="text-[#4A5565]">New: <span className="text-[#DC2626] font-medium">{detectionNew}</span></span>
            <span className="text-[#4A5565]">Resolved: <span className="text-[#10B981] font-medium">{detectionResolved}</span></span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden bg-[#F9FAFB]">
          {/* Left Sidebar - Clash List */}
          <div className="w-[280px] flex-shrink-0 border-r border-[#E5E7EB] bg-white overflow-y-auto">
            {/* Search */}
            <div className="p-3 border-b border-[#E5E7EB]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search clashes..."
                  className="w-full rounded border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm placeholder:text-[#99A1AF] focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Clash Groups */}
            <div className="p-2">
              {clashGroups.map((group) => (
                <div key={group.id} className="mb-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between w-full px-2 py-2 text-left hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <svg 
                        className={cn("h-4 w-4 text-[#4A5565] transition-transform", expandedGroups.includes(group.id) && "rotate-90")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-medium text-[#101828]">{group.name}</span>
                    </div>
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#F3F4F6] text-xs text-[#4A5565]">
                      {group.count}
                    </span>
                  </button>

                  {/* Group Items */}
                  {expandedGroups.includes(group.id) && (
                    <div className="ml-4 border-l border-[#E5E7EB]">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedClash(item)}
                          className={cn(
                            "flex flex-col w-full px-3 py-2 text-left border-l-2 -ml-px",
                            selectedClash?.id === item.id 
                              ? "border-l-[#155DFC] bg-[#F0F9FF]" 
                              : "border-l-transparent hover:bg-gray-50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "h-2 w-2 rounded-full",
                              item.status === 'new' ? "bg-[#DC2626]" : 
                              item.status === 'active' ? "bg-[#F59E0B]" : 
                              "bg-[#10B981]"
                            )} />
                            <span className="text-sm font-medium text-[#101828]">{item.title}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium",
                              statusConfig[item.status]?.bg,
                              statusConfig[item.status]?.color
                            )}>
                              {statusConfig[item.status]?.label}
                            </span>
                            <span className="text-[10px] text-[#4A5565]">{item.type}</span>
                            {item.distance && (
                              <span className="text-[10px] text-[#6A7282]">{item.distance}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center/Right - Viewer Area */}
          <div className="flex-1 flex">
            {/* 2D View */}
            {(viewMode === '2d' || viewMode === 'split') && (
              <div className={cn("flex flex-col bg-[#F9FAFB]", viewMode === 'split' ? "flex-1 border-r border-[#E5E7EB]" : "flex-1")}>
                {/* 2D Toolbar */}
                <div className="flex items-center gap-1 bg-[#364153] px-2 py-1">
                  {['Pan', 'Zoom', 'Measure'].map((tool) => (
                    <button key={tool} className="px-3 py-1 text-xs text-white hover:bg-[#4A5565] rounded">
                      {tool}
                    </button>
                  ))}
                </div>
                {/* 2D Content */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-24 mx-auto border-2 border-dashed border-[#D1D5DC] rounded-lg flex items-center justify-center mb-2">
                      <svg className="h-8 w-8 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    </div>
                    <p className="text-sm text-[#6A7282]">2D Floor Plan View</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3D View */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div className="flex-1 flex flex-col bg-[#1a1a2e]">
                {/* 3D Toolbar */}
                <div className="flex items-center gap-1 bg-[#364153] px-2 py-1">
                  {['Orbit', 'Pan', 'Zoom', 'Section', 'Measure'].map((tool) => (
                    <button key={tool} className="px-3 py-1 text-xs text-white hover:bg-[#4A5565] rounded">
                      {tool}
                    </button>
                  ))}
                </div>
                {/* 3D Content */}
                <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44]">
                  <div className="text-center">
                    <div className="w-48 h-32 mx-auto border-2 border-dashed border-[#4A5565] rounded-lg flex items-center justify-center mb-2 relative overflow-hidden">
                      {/* Placeholder 3D visualization */}
                      <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-4 left-4 w-16 h-20 bg-red-500/50 transform rotate-12" />
                        <div className="absolute bottom-4 right-4 w-20 h-16 bg-green-500/50 transform -rotate-6" />
                      </div>
                      <svg className="h-8 w-8 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                      </svg>
                    </div>
                    <p className="text-sm text-[#6A7282]">3D Model View</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel - Selected Clash Details */}
        {selectedClash && (
          <div className="bg-white border-t border-[#E5E7EB] px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#101828] mb-2">{selectedClash.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    statusConfig[selectedClash.status]?.bg,
                    statusConfig[selectedClash.status]?.color
                  )}>
                    {statusConfig[selectedClash.status]?.label}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-xs text-[#364153]">
                    {selectedClash.type}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    severityConfig[selectedClash.severity]?.bg,
                    severityConfig[selectedClash.severity]?.color
                  )}>
                    {severityConfig[selectedClash.severity]?.label}
                  </span>
                </div>

                {/* Element Info */}
                <div className="grid grid-cols-2 gap-8">
                  {selectedClash.element1 && (
                    <div>
                      <p className="text-xs text-[#6A7282] mb-1">Element 1</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.element1.name}</p>
                      <p className="text-xs text-[#4A5565]">{selectedClash.element1.category}</p>
                      <p className="text-xs text-[#6A7282]">{selectedClash.element1.file}</p>
                    </div>
                  )}
                  {selectedClash.element2 && (
                    <div>
                      <p className="text-xs text-[#6A7282] mb-1">Element 2</p>
                      <p className="text-sm font-medium text-[#101828]">{selectedClash.element2.name}</p>
                      <p className="text-xs text-[#4A5565]">{selectedClash.element2.category}</p>
                      <p className="text-xs text-[#6A7282]">{selectedClash.element2.file}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned To */}
              <div className="text-right">
                <p className="text-xs text-[#6A7282] mb-1">Assigned to</p>
                <p className="text-sm font-medium text-[#101828]">{selectedClash.assignedTo}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default List View
  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[24px] font-normal text-[#101828]">Clash Detection</h2>
        </div>
        <button 
          onClick={() => setIsDetectionView(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-sm font-normal text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Run Detection
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Total Clashes</span>
          <span className="text-2xl font-normal text-[#101828]">{totalClashes + 18}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">High Severity</span>
          <span className="text-2xl font-normal text-[#EC003F]">{highSeverity + 9}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">In Progress</span>
          <span className="text-2xl font-normal text-[#4F39F6]">{inProgress + 4}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
          <span className="text-xs text-[#4A5565]">Resolved</span>
          <span className="text-2xl font-normal text-[#009966]">{resolved + 4}</span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative w-[448px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search clashes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white py-2 pl-10 pr-4 text-sm text-[#101828] placeholder:text-[#6A7282] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'all'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('high')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'high'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            High
          </button>
          <button
            onClick={() => setFilterType('medium')}
            className={cn(
              "rounded-[10px] px-3 py-2 text-xs font-normal transition-colors",
              filterType === 'medium'
                ? "bg-[#F0F9FF] text-[#0069A8]"
                : "border border-[#E5E7EB] bg-white text-[#364153] hover:bg-gray-50"
            )}
          >
            Medium
          </button>
        </div>
      </div>

      {/* Clashes List */}
      <div className="rounded-[10px] border border-[#E5E7EB] bg-white">
        {filteredClashes.map((clash, index) => (
          <div
            key={clash.id}
            className={cn(
              "flex gap-4 p-6",
              index !== filteredClashes.length - 1 && "border-b border-[#E5E7EB]"
            )}
          >
            {/* Warning Icon */}
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]", iconColors[clash.status])}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col gap-2">
              {/* Tags Row */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#101828]">{clash.id}</span>
                <span className={cn("rounded px-2 py-0.5 text-xs", statusConfig[clash.status].bg, statusConfig[clash.status].color)}>
                  {statusConfig[clash.status].label}
                </span>
                <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#364153]">
                  {clash.type}
                </span>
                <span className={cn("rounded px-2 py-0.5 text-xs", severityConfig[clash.severity].bg, severityConfig[clash.severity].color)}>
                  {severityConfig[clash.severity].label}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-normal text-[#101828]">{clash.title}</h3>

              {/* Location */}
              <p className="text-sm text-[#4A5565]">{clash.location}</p>

              {/* Models */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6A7282]">Models:</span>
                {clash.models.map((model, idx) => (
                  <span key={idx} className="rounded bg-[#F3F4F6] px-2 py-1 text-xs text-[#364153]">
                    {model}
                  </span>
                ))}
              </div>

              {/* Footer Row */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#6A7282]">Assigned to {clash.assignedTo}</span>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#009966] px-3 py-1.5 text-xs text-white hover:bg-emerald-600 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Resolve
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#364153] hover:bg-gray-200 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View 3D
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
