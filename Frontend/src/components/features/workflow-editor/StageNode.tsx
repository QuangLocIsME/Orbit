// StageNode - Custom node component for workflow stages
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StageData } from './WorkflowEditor';

const STAGE_COLORS = {
  gray: { bg: '#F3F4F6', border: '#9CA3AF', text: '#364153' },
  blue: { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  yellow: { bg: '#FEF9C3', border: '#EAB308', text: '#A16207' },
  orange: { bg: '#FFEDD5', border: '#F97316', text: '#C2410C' },
  green: { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
  red: { bg: '#FEE2E2', border: '#EF4444', text: '#DC2626' },
};

const TYPE_ICONS = {
  start: (color: string) => (
    <svg className="h-4 w-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  process: (color: string) => (
    <svg className="h-4 w-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  decision: (color: string) => (
    <svg className="h-4 w-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2}>
      <path d="M12 2l10 10-10 10L2 12z" />
    </svg>
  ),
  end: (color: string) => (
    <svg className="h-4 w-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
};

export const StageNode = memo(({ data, selected }: NodeProps<StageData>) => {
  const colors = STAGE_COLORS[data.color || 'gray'];
  const Icon = TYPE_ICONS[data.type || 'process'];

  return (
    <div
      className="relative transition-all duration-200"
      style={{
        filter: selected ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))' : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-card transition-all hover:!bg-primary"
      />

      {/* Node Content */}
      <div
        className="rounded-xl border-2 p-4 min-w-[180px] max-w-[220px] bg-white transition-all"
        style={{
          backgroundColor: colors.bg,
          borderColor: selected ? '#155DFC' : colors.border,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          {Icon(colors.text)}
          <span className="font-medium text-sm truncate" style={{ color: colors.text }}>
            {data.name || 'Untitled Stage'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.description || 'No description'}
        </p>

        {/* Stage Type Badge */}
        <div className="mt-2 flex items-center gap-1.5">
          <span 
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{ 
              backgroundColor: `${colors.border}20`,
              color: colors.text 
            }}
          >
            {data.type || 'process'}
          </span>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-card transition-all hover:!bg-primary"
      />

      {/* Selected indicator */}
      {selected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-card" />
      )}
    </div>
  );
});

StageNode.displayName = 'StageNode';
