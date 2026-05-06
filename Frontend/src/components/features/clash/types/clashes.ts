export interface Clash {
  id: string;
  status: 'open' | 'in-progress' | 'resolved' | 'new' | 'active' | 'waived';
  type: 'Hard Clash' | 'Soft Clash';
  severity: 'critical' | 'high' | 'medium' | 'low';
  clashType?: 'hard' | 'soft';
  resolved: boolean;
  waived?: boolean;
  /** True khi clash đã từng detect nhưng không còn trong kết quả mới nhất */
  stale?: boolean;
  objectA: string;
  objectB: string;
  objectAIdentifiers?: string[];
  objectBIdentifiers?: string[];
  position: [number, number, number];
  title: string;
  location: string;
  models: string[];
  assignedTo: string;
  dueDate?: string;
  distance?: string;
  note?: string;
  updatedAt?: string;
  history?: ClashHistoryEntry[];
  element1?: { name: string; category: string; file: string };
  element2?: { name: string; category: string; file: string };
  /** Bounding boxes — forwarded từ backend để tính tọa độ thật trong viewer */
  objectABBox?: BBox;
  objectBBBox?: BBox;
}

export interface ClashGroup {
  id: string;
  name: string;
  count: number;
  items: Clash[];
}

export type BBox = { min: [number, number, number]; max: [number, number, number] };

export interface BackendClash {
  id: string;
  objectA: string;
  objectB: string;
  objectAIdentifiers?: string[];
  objectBIdentifiers?: string[];
  position: [number, number, number];
  severity: 'low' | 'medium' | 'high' | 'critical';
  clashType?: 'hard' | 'soft';
  stale?: boolean;
  resolved?: boolean;
  waived?: boolean;
  status?: 'open' | 'in-progress' | 'resolved' | 'waived';
  note?: string;
  updatedAt?: string;
  history?: ClashHistoryEntry[];
  intersectionVolume?: number;
  distance?: number;
  groupKey?: string;
  /** Bounding boxes của từng object — dùng để tính tọa độ thật trong viewer */
  objectABBox?: BBox;
  objectBBBox?: BBox;
  objectAType?: string;
  objectBType?: string;
  assignedTo?: string;
  dueDate?: string;
}

export interface BackendClashGroup {
  id: string;
  name: string;
  count: number;
  items: BackendClash[];
}

export interface BackendClashResponse {
  clashes: BackendClash[];
  summary?: {
    total: number;
    stale: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    hardClashes: number;
    softClashes: number;
    resolved: number;
    waived: number;
  };
  groups?: BackendClashGroup[];
}

export interface ClashHistoryEntry {
  id: string;
  type: 'created' | 'severity-changed' | 'note-added' | 'focused' | 'resolved';
  message: string;
  timestamp: string;
}

export type Viewer2DTool = 'Pan' | 'Zoom' | 'Measure';
export type Viewer3DTool = 'Orbit' | 'Pan' | 'Zoom' | 'Section' | 'Measure';
export type MockViewerMode = 'default' | 'zoom' | 'measure' | 'section';
export type ViewerOffset = { x: number; y: number };
export type ResolutionFilter = 'all' | 'resolved' | 'unresolved';

export interface MockViewerSelection {
  id: string;
  label: string;
}

export interface ViewerInteractionState {
  offset: ViewerOffset;
  scale: number;
  orbitAngle: number;
  sectionEnabled: boolean;
  measureEnabled: boolean;
  selectedObjectId: string | null;
}

export interface ViewerObjectState {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number; height: number };
  isSelected: boolean;
  isColliding: boolean;
}

const DEFAULT_ASSIGNEE = 'Unassigned';

export const statusConfig = {
  open: { label: 'open', bg: 'bg-[#FFF1F2]', color: 'text-[#C70036]' },
  'in-progress': { label: 'in-progress', bg: 'bg-[#FEF3C7]', color: 'text-[#B45309]' },
  resolved: { label: 'resolved', bg: 'bg-[#D1FAE5]', color: 'text-[#059669]' },
  waived: { label: 'waived', bg: 'bg-[#FFF7ED]', color: 'text-[#C2410C]' },
  new: { label: 'New', bg: 'bg-[#10B981]', color: 'text-white' },
  active: { label: 'Active', bg: 'bg-[#F59E0B]', color: 'text-white' },
} as const;

export const severityConfig = {
  critical: { label: 'CRITICAL', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  high: { label: 'high', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
  medium: { label: 'medium', bg: 'bg-[#FFF7ED]', color: 'text-[#C2410C]' },
  low: { label: 'low', bg: 'bg-[#F0FDF4]', color: 'text-[#16A34A]' },
} as const;

export const iconColors = {
  open: 'text-[#0084D1] bg-[#F0F9FF]',
  'in-progress': 'text-[#F59E0B] bg-[#FEF3C7]',
  resolved: 'text-[#10B981] bg-[#D1FAE5]',
  waived: 'text-[#C2410C] bg-[#FFF7ED]',
  new: 'text-[#DC2626] bg-[#FEF2F2]',
  active: 'text-[#F59E0B] bg-[#FEF3C7]',
} as const;

export const formatDistance = (distance?: number) =>
  typeof distance === 'number' ? `${distance.toFixed(2)} m` : undefined;

export const formatPosition = (position: [number, number, number]) =>
  `X: ${position[0].toFixed(2)}, Y: ${position[1].toFixed(2)}, Z: ${position[2].toFixed(2)}`;

export const prettifyIfcType = (type: string) => type.replace(/^Ifc/, '');

export const createHistoryEntry = (
  type: ClashHistoryEntry['type'],
  message: string,
  timestamp = new Date().toISOString()
): ClashHistoryEntry => ({
  id: `${type}-${timestamp}`,
  type,
  message,
  timestamp,
});

export const getDefaultClashStatus = (severity: BackendClash['severity']): Clash['status'] => {
  if (severity === 'high') return 'open';
  if (severity === 'medium') return 'in-progress';
  return 'open';
};

export const getDetectionStatus = (severity: BackendClash['severity']): Clash['status'] => {
  if (severity === 'high') return 'new';
  return 'active';
};

export const getRenderedClashStatus = (clash: Clash): Clash['status'] =>
  clash.resolved ? 'resolved' : clash.status === 'resolved' ? 'open' : clash.status;

export const matchesResolutionFilter = (clash: Clash, filter: ResolutionFilter) => {
  if (filter === 'resolved') return clash.resolved;
  if (filter === 'unresolved') return !clash.resolved;
  return true;
};

export const toListClash = (clash: BackendClash): Clash => {
  const typeA = clash.objectAType ?? clash.groupKey?.split('__')[0] ?? 'ObjectA';
  const typeB = clash.objectBType ?? clash.groupKey?.split('__')[1] ?? 'ObjectB';
  const uiSeverity = clash.severity as Clash['severity'];
  const timestamp = clash.updatedAt ?? new Date().toISOString();
  const isHard = clash.clashType === 'hard' || (clash.intersectionVolume !== undefined && clash.intersectionVolume > 0);

  const status: Clash['status'] = clash.waived
    ? 'waived'
    : clash.status
    ? (clash.status as Clash['status'])
    : getDefaultClashStatus(clash.severity);

  return {
    id: clash.id,
    status,
    type: isHard ? 'Hard Clash' : 'Soft Clash',
    clashType: clash.clashType,
    severity: uiSeverity,
    resolved: Boolean(clash.resolved),
    waived: Boolean(clash.waived),
    objectA: clash.objectA,
    objectB: clash.objectB,
    position: clash.position,
    title: `${prettifyIfcType(typeA)} intersects ${prettifyIfcType(typeB)}`,
    location: formatPosition(clash.position),
    models: [clash.objectA, clash.objectB],
    assignedTo: clash.assignedTo || DEFAULT_ASSIGNEE,
    dueDate: clash.dueDate,
    distance: formatDistance(clash.distance),
    note: clash.note,
    updatedAt: timestamp,
    history: clash.history?.length
      ? clash.history
      : [createHistoryEntry('created', `Clash detected between ${clash.objectA} and ${clash.objectB}.`, timestamp)],
    element1: { name: clash.objectA, category: prettifyIfcType(typeA), file: 'Model' },
    element2: { name: clash.objectB, category: prettifyIfcType(typeB), file: 'Model' },
    objectABBox: clash.objectABBox,
    objectBBBox: clash.objectBBBox,
    stale: clash.stale,
  };
};

export const toDetectionClash = (clash: BackendClash): Clash => ({
  ...toListClash(clash),
  status: clash.resolved ? 'resolved' : getDetectionStatus(clash.severity),
});

export const toDetectionGroups = (groups: BackendClashGroup[] = []): ClashGroup[] =>
  groups.map((group) => ({
    id: group.id,
    name: group.name,
    count: group.count,
    items: group.items.map(toDetectionClash),
  }));

