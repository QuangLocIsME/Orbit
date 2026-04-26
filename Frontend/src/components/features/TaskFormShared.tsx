/**
 * Shared form components used by both CreateTaskModal and ChangesTab.
 * Contains: FileIcon, Avatar, MemberPicker, AttachPicker, AffectedModelsPicker.
 */

'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Constants & Helpers ───────────────────────────────────────────────────────

export const MAX_ATTACH_SIZE = 50 * 1024 * 1024; // 50 MB

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── FileIcon ─────────────────────────────────────────────────────────────────

export function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
      <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z"/>
      <path d="M9.33333 1.33333V5.33333H13.3333"/>
    </svg>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  avatarSrc?: string | null;
}

export function Avatar({ name, color = '#6366f1', size = 'xs', avatarSrc }: AvatarProps) {
  const initials = (name || '')
    .split(' ')
    .map(w => w?.[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-7 w-7 text-[11px]',
  };
  const sizeClass = sizes[size];
  return avatarSrc ? (
    <img
      src={avatarSrc}
      alt={name || initials}
      title={name}
      className={cn('rounded-full object-cover shrink-0', sizeClass)}
    />
  ) : (
    <span
      title={name}
      className={cn('inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0', sizeClass)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

// ─── MemberPicker ─────────────────────────────────────────────────────────────

interface MemberOption {
  userId: string;
  role?: string;
  user?: { fullName?: string; email?: string; name?: string; avatar?: string | null } | null;
}

interface MemberPickerProps {
  label: string;
  members?: MemberOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function MemberPicker({ label, members = [], selected, onChange }: MemberPickerProps) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">{label}</label>
      {!members || members.length === 0 ? (
        <p className="text-[13px] text-[#6A7282]">No team members available.</p>
      ) : (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[150px] overflow-y-auto">
          {members.map(m => {
            const checked = selected.includes(m.userId);
            const memberName = m.user?.fullName || m.user?.name || m.user?.email || 'Unknown';
            return (
              <label key={m.userId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.userId)}
                  className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
                />
                <Avatar name={memberName} size="sm" avatarSrc={m.user?.avatar} />
                <div className="min-w-0">
                  <p className="text-[14px] text-[#101828] truncate">{memberName}</p>
                  <p className="text-[11px] text-[#6A7282] truncate">{m.role || ''}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const m = members.find(x => x.userId === id);
            const memberName = m?.user?.fullName || m?.user?.name || 'Unknown';
            return m ? (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2 py-0.5 text-[11px] text-[#1D4ED8]">
                <Avatar name={memberName} color="#3B82F6" size="xs" avatarSrc={m?.user?.avatar} />
                {memberName}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">x</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ─── AffectedModelsPicker ─────────────────────────────────────────────────────

interface ModelFileOption {
  id: string;
  name: string;
  folderPath?: string;
}

interface AffectedModelsPickerProps {
  modelFiles?: ModelFileOption[];
  loadingFiles?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function AffectedModelsPicker({
  modelFiles = [],
  loadingFiles = false,
  selected,
  onChange,
}: AffectedModelsPickerProps) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">Affected Models</label>
      {loadingFiles ? (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">Loading model files...</div>
      ) : modelFiles.length === 0 ? (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">
          No model files found. Upload IFC/RVT/DWG files in the <strong>Documents</strong> tab.
        </div>
      ) : (
        <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
          {modelFiles.map(f => (
            <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() => toggle(f.id)}
                className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
              />
              <FileIcon className="shrink-0 text-[#6A7282]" />
              <div className="min-w-0">
                <p className="text-[14px] text-[#101828] truncate">{f.name}</p>
                {f.folderPath && <p className="text-[11px] text-[#6A7282] truncate">{f.folderPath}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const f = modelFiles.find(m => m.id === id);
            return f ? (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] text-[#1D4ED8]">
                {f.name}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">x</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ─── AttachPicker ─────────────────────────────────────────────────────────────

interface AttachPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function AttachPicker({ files, onChange }: AttachPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    Array.from(incoming).forEach(f => {
      if (f.size > MAX_ATTACH_SIZE) {
        toast.error(`"${f.name}" exceeds 50 MB limit`);
      } else {
        valid.push(f);
      }
    });
    onChange([...files, ...valid]);
  };

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-[#101828]">
        Attachments <span className="font-normal text-[#6A7282]">(max 50 MB each)</span>
      </label>

      {files.length > 0 && (
        <div className="rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6] bg-white">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <FileIcon className="shrink-0 text-[#6A7282]" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[#101828] truncate">{f.name}</p>
                <p className="text-[11px] text-[#6A7282]">{fmtSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 p-1 text-[#99A1AF] hover:text-[#DC2626] transition-colors rounded"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed py-6 cursor-pointer transition-colors',
          drag ? 'border-[#155DFC] bg-[#EFF6FF]' : 'border-[#D1D5DC] bg-[#F9FAFB] hover:border-[#155DFC] hover:bg-[#F0F6FF]'
        )}
      >
        <svg className="h-8 w-8 text-[#99A1AF]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21.333 21.333L16 16L10.667 21.333" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 16V28" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M27.187 24.52C28.458 23.787 29.431 22.63 29.936 21.246C30.441 19.862 30.447 18.34 29.953 16.952C29.459 15.564 28.495 14.399 27.229 13.656C25.964 12.913 24.477 12.641 23.04 12.88H21.467C21.029 11.207 20.207 9.66 19.067 8.368C17.927 7.077 16.502 6.078 14.905 5.454C13.309 4.829 11.586 4.598 9.879 4.778C8.172 4.959 6.531 5.546 5.096 6.489C3.66 7.433 2.471 8.707 1.626 10.207C0.78 11.707 0.304 13.39 0.238 15.114C0.172 16.839 0.519 18.555 1.249 20.117C1.979 21.68 3.069 23.043 4.427 24.093" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[14px] text-[#364153]">Drop files here or <span className="text-[#155DFC] font-medium">browse</span></p>
        <p className="text-[12px] text-[#6A7282]">PDF, DWG, RVT, IFC, JPG, PNG — max 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { add(e.target.files); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}
