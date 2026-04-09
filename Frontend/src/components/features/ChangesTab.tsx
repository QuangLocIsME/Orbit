'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

interface ChangeRequest {
  publicId: string;
  crId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'approved' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  affectedModels: string[];
  disciplineId: string | null;
  assignedTo: string[];
  reviewers: string[];
  attachments: Attachment[];
  estimatedImpact: 'low' | 'medium' | 'high' | null;
  estimatedCost: number | null;
  estimatedDuration: string;
  deadline: string | null;
  detailedDescription: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Discipline { id: string; name: string; color: string; description: string; }
interface ModelFile  { id: string; name: string; size?: number; folderPath?: string; }
interface TeamMember { publicId: string; userId: string; role: string; status: string; user: { fullName: string; email: string; avatar?: string } | null; }
interface ChangesTabProps { projectPublicId: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:      { label: 'Pending',     bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]' },
  'in-progress':{ label: 'In Progress', bg: 'bg-[#EEF2FF]', text: 'text-[#432DD7]' },
  approved:     { label: 'Approved',    bg: 'bg-[#ECFDF5]', text: 'text-[#007A55]' },
  completed:    { label: 'Completed',   bg: 'bg-[#ECFDF5]', text: 'text-[#007A55]' },
  rejected:     { label: 'Rejected',    bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
} as const;

const PRIORITY_CFG = {
  urgent: { label: 'Urgent', bg: 'bg-[#FFF1F2]', text: 'text-[#C70036]' },
  high:   { label: 'High',   bg: 'bg-[#FFF1F2]', text: 'text-[#C70036]' },
  medium: { label: 'Medium', bg: 'bg-[#F0F9FF]',  text: 'text-[#0069A8]' },
  low:    { label: 'Low',    bg: 'bg-[#F3F4F6]',  text: 'text-[#364153]' },
} as const;

const ICON_BG     = { pending:'bg-[#EEF2FF]', 'in-progress':'bg-[#EEF2FF]', approved:'bg-[#ECFDF5]', completed:'bg-[#ECFDF5]', rejected:'bg-[#FEE2E2]' } as const;
const ICON_STROKE = { pending:'#4F39F6', 'in-progress':'#4F39F6', approved:'#009966', completed:'#009966', rejected:'#DC2626' } as const;
const MAX_ATTACH_SIZE = 50 * 1024 * 1024; // 50 MB
const MODEL_EXT = /\.(ifc|rvt|dwg|dxf|nwd|nwf|nwc|skp|fbx|obj|3ds|step|stp)$/i;

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fmtRel(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function CrIcon({ status }: { status: ChangeRequest['status'] }) {
  const s = ICON_STROKE[status];
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      <path d="M12.659 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8.00001C20.0008 7.68312 19.9388 7.36921 19.8176 7.0764C19.6964 6.78359 19.5185 6.51768 19.294 6.29401L15.706 2.70601C15.4823 2.48153 15.2164 2.30357 14.9236 2.18239C14.6308 2.06122 14.3169 1.99923 14 2.00001H6C5.46957 2.00001 4.96086 2.21072 4.58579 2.58579C4.21071 2.96087 4 3.46957 4 4.00001V13.34" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.378 12.6219C10.7762 12.224 11.3162 12.0007 11.8791 12.001C12.442 12.0013 12.9817 12.2251 13.3795 12.6234C13.7773 13.0216 14.0007 13.5615 14.0004 14.1244C14.0001 14.6873 13.7762 15.227 13.378 15.6249L8.36002 20.6369C8.1224 20.8746 7.82869 21.0486 7.50602 21.1429L4.63902 21.9799C4.55298 22.005 4.46176 22.0065 4.37493 21.9842C4.2881 21.962 4.20885 21.9168 4.14547 21.8534C4.08209 21.79 4.03691 21.7108 4.01467 21.6239C3.99242 21.5371 3.99393 21.4459 4.01902 21.3599L4.85502 18.4909C4.9494 18.1686 5.12341 17.8752 5.36102 17.6379L10.378 12.6219Z" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.33}>
      <path d="M9.33333 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V5.33333L9.33333 1.33333Z"/>
      <path d="M9.33333 1.33333V5.33333H13.3333"/>
    </svg>
  );
}

/** Avatar initials chip */
function Avatar({ name, color }: { name?: string; color?: string }) {
  const initials = (name || '').split(' ').map(w => w?.[0]).join('').toUpperCase().slice(0, 2) || '?';
  const bg = color || '#6366f1';
  return (
    <span
      title={name}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  );
}

/** Member multi-select list */
function MemberPicker({
  label, members = [], selected, onChange,
}: {
  label: string;
  members?: TeamMember[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
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
            return (
              <label key={m.userId} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.userId)}
                  className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]"
                />
                <Avatar name={m.user?.fullName} />
                <div className="min-w-0">
                  <p className="text-[14px] text-[#101828] truncate">{m.user?.fullName}</p>
                  <p className="text-[11px] text-[#6A7282] truncate">{m.role}</p>
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
            return m ? (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2 py-0.5 text-[11px] text-[#1D4ED8]">
                <Avatar name={m.user?.fullName} color="#3B82F6" />
                {m.user?.fullName}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">×</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/** File attachment drop zone */
function AttachPicker({
  files, onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
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

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  projectPublicId: string;
  disciplines: Discipline[];
  modelFiles: ModelFile[];
  teamMembers: TeamMember[];
  loadingFiles: boolean;
  onClose: () => void;
  onCreated: (cr: ChangeRequest) => void;
}

function CreateModal({ projectPublicId, disciplines, modelFiles, teamMembers, loadingFiles, onClose, onCreated }: CreateModalProps) {
  const [title, setTitle]                         = useState('');
  const [description, setDescription]             = useState('');
  const [priority, setPriority]                   = useState<ChangeRequest['priority']>('medium');
  const [estimatedImpact, setEstimatedImpact]     = useState<'low' | 'medium' | 'high' | ''>('');
  const [detailedDescription, setDetailedDesc]    = useState('');
  const [estimatedCost, setEstimatedCost]         = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [deadline, setDeadline]                   = useState('');
  const [disciplineId, setDisciplineId]           = useState('');
  const [affectedModels, setAffectedModels]       = useState<string[]>([]);
  const [assignedTo, setAssignedTo]               = useState<string[]>([]);
  const [reviewers, setReviewers]                 = useState<string[]>([]);
  const [attachments, setAttachments]             = useState<File[]>([]);
  const [submitting, setSubmitting]               = useState(false);

  const toggleModel = (id: string) =>
    setAffectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!title.trim())       { toast.error('Title is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!estimatedImpact)    { toast.error('Estimated Impact is required'); return; }

    setSubmitting(true);
    try {
      // If attachments present → use FormData, else JSON
      let res: Response;
      if (attachments.length > 0) {
        const form = new FormData();
        form.append('title', title.trim());
        form.append('description', description.trim());
        form.append('priority', priority);
        form.append('estimatedImpact', estimatedImpact);
        if (detailedDescription.trim()) form.append('detailedDescription', detailedDescription.trim());
        if (estimatedCost.trim()) form.append('estimatedCost', estimatedCost.trim());
        if (estimatedDuration.trim()) form.append('estimatedDuration', estimatedDuration.trim());
        if (deadline) form.append('deadline', deadline);
        if (disciplineId) form.append('disciplineId', disciplineId);
        affectedModels.forEach(m => form.append('affectedModels[]', m));
        assignedTo.forEach(a => form.append('assignedTo[]', a));
        reviewers.forEach(r => form.append('reviewers[]', r));
        attachments.forEach(f => form.append('attachments', f));
        res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`, { method: 'POST', body: form });
      } else {
        res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            estimatedImpact,
            detailedDescription: detailedDescription.trim() || undefined,
            estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : undefined,
            estimatedDuration: estimatedDuration.trim() || undefined,
            deadline: deadline || undefined,
            disciplineId: disciplineId || null,
            affectedModels,
            assignedTo,
            reviewers,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        toast.success('Change request created');
        onCreated(data.data);
        onClose();
      } else {
        toast.error(data.message || 'Failed to create change request');
      }
    } catch {
      toast.error('Failed to create change request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-[680px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#EFF6FF]">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                <path d="M10 4.16667V15.8333" stroke="#155DFC" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.16667 10H15.8333" stroke="#155DFC" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828]">Create Change Request</h2>
              <p className="text-[12px] text-[#6A7282]">Submit a change request for review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Title <span className="text-[#FF2056]">*</span></label>
            <input
              type="text"
              placeholder="Enter change request title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Priority <span className="text-[#FF2056]">*</span></label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                <button
                  key={p} type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'h-10 rounded-[10px] text-[14px] capitalize transition-colors border',
                    priority === p ? 'bg-[#F0F9FF] border-[#155DFC] text-[#0069A8]' : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                  )}
                >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* Estimated Impact */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Estimated Impact <span className="text-[#FF2056]">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'low',    label: 'Low',    active: 'bg-[#F0FDF4] border-[#22C55E] text-[#15803D]', dot: 'bg-[#22C55E]' },
                { val: 'medium', label: 'Medium', active: 'bg-[#FFFBEB] border-[#F59E0B] text-[#B45309]', dot: 'bg-[#F59E0B]' },
                { val: 'high',   label: 'High',   active: 'bg-[#FFF1F2] border-[#F43F5E] text-[#C70036]', dot: 'bg-[#F43F5E]' },
              ] as const).map(({ val, label, active, dot }) => (
                <button
                  key={val} type="button"
                  onClick={() => setEstimatedImpact(val)}
                  className={cn(
                    'h-10 rounded-[10px] text-[14px] font-medium transition-colors border flex items-center justify-center gap-2',
                    estimatedImpact === val ? active : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', estimatedImpact === val ? dot : 'bg-[#D1D5DC]')} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Description <span className="text-[#FF2056]">*</span></label>
            <textarea
              placeholder="Brief description of the requested change..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
            />
          </div>

          {/* Detailed Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Detailed Description <span className="text-[12px] font-normal text-[#6A7282]">(optional)</span></label>
            <textarea
              placeholder="Provide a thorough explanation of the change, its rationale, and expected outcomes..."
              value={detailedDescription}
              onChange={e => setDetailedDesc(e.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
            />
          </div>

          {/* Estimated Cost + Duration — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Cost</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#6A7282] select-none">$</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={estimatedCost}
                  onChange={e => setEstimatedCost(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-7 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Duration</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="e.g. 2 weeks"
                  value={estimatedDuration}
                  onChange={e => setEstimatedDuration(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-9 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                />
              </div>
            </div>
          </div>

          {/* Deadline + Discipline — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Discipline</label>
              {disciplines.length === 0 ? (
                <p className="text-[13px] text-[#6A7282] mt-1">No disciplines — add in <strong>Settings</strong>.</p>
              ) : (
                <select
                  value={disciplineId}
                  onChange={e => setDisciplineId(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
                >
                  <option value="">Select discipline...</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Assignees + Reviewers — 2 col */}
          <div className="grid grid-cols-2 gap-4">
            <MemberPicker label="Assigned To" members={teamMembers} selected={assignedTo} onChange={setAssignedTo} />
            <MemberPicker label="Reviewers"   members={teamMembers} selected={reviewers}  onChange={setReviewers}  />
          </div>

          {/* Affected Models */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Affected Models</label>
            {loadingFiles ? (
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">Loading model files…</div>
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
                      checked={affectedModels.includes(f.id)}
                      onChange={() => toggleModel(f.id)}
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
            {affectedModels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {affectedModels.map(id => {
                  const f = modelFiles.find(m => m.id === id);
                  return f ? (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[11px] text-[#1D4ED8]">
                      {f.name}
                      <button type="button" onClick={() => toggleModel(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">×</button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Attachments */}
          <AttachPicker files={attachments} onChange={setAttachments} />

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <p className="text-[12px] text-[#6A7282]">{attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached` : ''}</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors">Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-5 py-2 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creating…</>
              ) : 'Create Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  cr, disciplines, modelFiles, teamMembers, onClose, onStatusChange,
}: {
  cr: ChangeRequest;
  disciplines: Discipline[];
  modelFiles: ModelFile[];
  teamMembers: TeamMember[];
  onClose: () => void;
  onStatusChange: (id: string, s: ChangeRequest['status']) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const disc = disciplines.find(d => d.id === cr.disciplineId);
  const sc = STATUS_CFG[cr.status];
  const pc = PRIORITY_CFG[cr.priority];

  const handleStatus = async (status: ChangeRequest['status']) => {
    setUpdating(true);
    try {
      const res = await apiFetch('/api/change-requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId: cr.publicId, status }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Status → ${status}`); onStatusChange(cr.publicId, status); }
      else toast.error(data.message || 'Failed to update');
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-[600px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]', ICON_BG[cr.status])}>
              <CrIcon status={cr.status} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[13px] text-[#6A7282]">{cr.crId}</span>
                <span className={cn('rounded px-2 py-0.5 text-[12px]', sc.bg, sc.text)}>{sc.label}</span>
                <span className={cn('rounded px-2 py-0.5 text-[12px]', pc.bg, pc.text)}>{pc.label}</span>
              </div>
              <h2 className="text-[16px] font-semibold text-[#101828] mt-1">{cr.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 shrink-0 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {cr.description && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Description</p>
              <p className="text-[14px] text-[#364153] leading-relaxed">{cr.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {disc && (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Discipline</p>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium text-white" style={{ backgroundColor: disc.color }}>{disc.name}</span>
              </div>
            )}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Created</p>
              <p className="text-[14px] text-[#364153]">{new Date(cr.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Assignees */}
          {cr.assignedTo.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Assigned To</p>
              <div className="flex flex-wrap gap-2">
                {cr.assignedTo.map(id => {
                  const m = teamMembers.find(x => x.userId === id);
                  return m ? (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2.5 py-0.5 text-[12px] text-[#1D4ED8]">
                      <Avatar name={m.user?.fullName} color="#3B82F6" />{m.user?.fullName}
                    </span>
                  ) : <span key={id} className="text-[13px] text-[#6A7282]">{id}</span>;
                })}
              </div>
            </div>
          )}

          {/* Reviewers */}
          {cr.reviewers.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Reviewers</p>
              <div className="flex flex-wrap gap-2">
                {cr.reviewers.map(id => {
                  const m = teamMembers.find(x => x.userId === id);
                  return m ? (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] pl-1 pr-2.5 py-0.5 text-[12px] text-[#166534]">
                      <Avatar name={m.user?.fullName} color="#22C55E" />{m.user?.fullName}
                    </span>
                  ) : <span key={id} className="text-[13px] text-[#6A7282]">{id}</span>;
                })}
              </div>
            </div>
          )}

          {/* Affected Models */}
          {cr.affectedModels.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Affected Models</p>
              <div className="flex flex-wrap gap-1.5">
                {cr.affectedModels.map((id, i) => {
                  const f = modelFiles.find(m => m.id === id);
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F4F6] px-2.5 py-1 text-[12px] text-[#364153]">
                      <FileIcon className="text-[#6A7282]" />{f ? f.name : id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          {cr.attachments.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Attachments</p>
              <div className="rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                {cr.attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <FileIcon className="shrink-0 text-[#6A7282]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-[#101828] truncate">{a.name}</p>
                      <p className="text-[11px] text-[#6A7282]">{fmtSize(a.size)}</p>
                    </div>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[#155DFC] hover:underline text-[12px]">Download</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status actions */}
          {cr.status !== 'completed' && cr.status !== 'rejected' && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(['pending','in-progress','approved','completed','rejected'] as const)
                  .filter(s => s !== cr.status)
                  .map(s => {
                    const c = STATUS_CFG[s];
                    return (
                      <button key={s} disabled={updating} onClick={() => handleStatus(s)}
                        className={cn('rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-transparent transition-colors disabled:opacity-60', c.bg, c.text, 'hover:opacity-80')}
                      >{c.label}</button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828]">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChangesTab({ projectPublicId }: ChangesTabProps) {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loadingCR, setLoadingCR]           = useState(true);
  const [disciplines, setDisciplines]       = useState<Discipline[]>([]);
  const [modelFiles, setModelFiles]         = useState<ModelFile[]>([]);
  const [teamMembers, setTeamMembers]       = useState<TeamMember[]>([]);
  const [loadingFiles, setLoadingFiles]     = useState(false);
  const [filter, setFilter]                 = useState<'all'|'pending'|'in-progress'|'approved'>('all');
  const [search, setSearch]                 = useState('');
  const [showCreate, setShowCreate]         = useState(false);
  const [detailCR, setDetailCR]             = useState<ChangeRequest | null>(null);

  const loadCR = useCallback(async () => {
    setLoadingCR(true);
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`);
      if (res.ok) { const d = await res.json(); setChangeRequests(d?.data ?? []); }
    } catch { /* silent */ }
    finally { setLoadingCR(false); }
  }, [projectPublicId]);

  const loadMeta = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const [dRes, docsRes, teamRes] = await Promise.all([
        apiFetch(`/api/projects/${projectPublicId}/disciplines`),
        apiFetch(`/api/projects/packages/documents/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        }),
        apiFetch(`/api/projects/member-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        }),
      ]);
      if (dRes.ok)    { const d = await dRes.json(); setDisciplines(d.data || []); }
      if (docsRes.ok) {
        const d = await docsRes.json();
        const flatten = (nodes: any[]): ModelFile[] => {
          const out: ModelFile[] = [];
          for (const n of nodes ?? []) {
            if (n.type === 'file' && MODEL_EXT.test(n.name || '')) out.push({ id: n.id, name: n.name, folderPath: n.folderPath });
            if (n.children) out.push(...flatten(n.children));
          }
          return out;
        };
        const tree = d?.data?.tree;
        if (tree) setModelFiles(flatten(tree.children || []));
      }
      if (teamRes.ok) { const d = await teamRes.json(); setTeamMembers(d?.data || []); }
    } catch { /* silent */ }
    finally { setLoadingFiles(false); }
  }, [projectPublicId]);

  useEffect(() => { loadCR(); loadMeta(); }, [loadCR, loadMeta]);

  const filtered = changeRequests.filter(cr => {
    if (filter === 'pending'     && cr.status !== 'pending')     return false;
    if (filter === 'in-progress' && cr.status !== 'in-progress') return false;
    if (filter === 'approved'    && cr.status !== 'approved')    return false;
    if (search) {
      const q = search.toLowerCase();
      return cr.title.toLowerCase().includes(q) || cr.crId.toLowerCase().includes(q) || cr.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreated = (cr: ChangeRequest) => setChangeRequests(p => [cr, ...p]);
  const handleStatusChange = (id: string, status: ChangeRequest['status']) => {
    setChangeRequests(p => p.map(c => c.publicId === id ? { ...c, status } : c));
    setDetailCR(p => p?.publicId === id ? { ...p, status } : p);
  };

  const total      = changeRequests.length;
  const pending    = changeRequests.filter(c => c.status === 'pending').length;
  const inProgress = changeRequests.filter(c => c.status === 'in-progress').length;
  const approved   = changeRequests.filter(c => c.status === 'approved' || c.status === 'completed').length;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-normal text-[#101828]">Change Requests</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] h-10 px-5 text-[14px] font-normal text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',       value: total,      color: 'text-[#101828]' },
          { label: 'Pending',     value: pending,    color: 'text-[#B45309]' },
          { label: 'In Progress', value: inProgress, color: 'text-[#432DD7]' },
          { label: 'Approved',    value: approved,   color: 'text-[#007A55]' },
        ].map(s => (
          <div key={s.label} className="rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
            <p className="text-[12px] text-[#6A7282]">{s.label}</p>
            <p className={cn('text-[24px] font-normal mt-1', s.color)}>{loadingCR ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {(['all','pending','in-progress','approved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-2 rounded-[10px] text-[12px] transition-colors capitalize',
                filter === f ? 'bg-[#F0F9FF] text-[#0069A8]' : 'bg-white border border-[#E5E7EB] text-[#364153] hover:bg-gray-50'
              )}
            >{f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99A1AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white pl-9 pr-4 py-2 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]"
          />
        </div>
        <button onClick={loadCR} className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] text-[#364153] hover:bg-gray-50 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* List */}
      <div className="rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
        {loadingCR ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] mb-3">
              <svg className="h-7 w-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[#101828]">{changeRequests.length === 0 ? 'No change requests yet' : 'No results match the filter'}</p>
            <p className="text-[12px] text-[#6A7282] mt-1">{changeRequests.length === 0 ? 'Create your first change request using the button above' : 'Try adjusting your search or filter'}</p>
            {changeRequests.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#155DFC] px-4 py-2 text-[13px] text-white hover:bg-blue-700 transition-colors">New Request</button>
            )}
          </div>
        ) : (
          filtered.map((cr, idx) => {
            const sc   = STATUS_CFG[cr.status];
            const pc   = PRIORITY_CFG[cr.priority];
            const disc = disciplines.find(d => d.id === cr.disciplineId);
            const assigneeMembers  = cr.assignedTo.map(id => teamMembers.find(m => m.publicId === id || m.userId === id)).filter(Boolean) as TeamMember[];
            const reviewerMembers  = cr.reviewers.map(id => teamMembers.find(m => m.publicId === id || m.userId === id)).filter(Boolean) as TeamMember[];

            return (
              <div key={cr.publicId} className={cn('flex items-start gap-4 px-6 py-5', idx !== filtered.length - 1 && 'border-b border-[#E5E7EB]')}>
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-[10px] shrink-0', ICON_BG[cr.status])}>
                  <CrIcon status={cr.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-[13px] text-[#6A7282]">{cr.crId}</span>
                    <span className={cn('rounded px-2 py-0.5 text-[12px]', sc.bg, sc.text)}>{sc.label}</span>
                    <span className={cn('rounded px-2 py-0.5 text-[12px]', pc.bg, pc.text)}>{pc.label}</span>
                    {disc && (
                      <span className="rounded px-2 py-0.5 text-[12px] text-white font-medium" style={{ backgroundColor: disc.color }}>{disc.name}</span>
                    )}
                  </div>

                  <h3 className="text-[14px] font-medium text-[#101828] mb-1">{cr.title}</h3>
                  {cr.description && <p className="text-[13px] text-[#4A5565] mb-3 line-clamp-2">{cr.description}</p>}

                  {/* Affected models */}
                  {cr.affectedModels.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="text-[11px] text-[#6A7282]">Models:</span>
                      {cr.affectedModels.slice(0, 3).map((id, i) => {
                        const f = modelFiles.find(m => m.id === id);
                        return <span key={i} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]"><FileIcon />{f ? f.name : id}</span>;
                      })}
                      {cr.affectedModels.length > 3 && <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6A7282]">+{cr.affectedModels.length - 3} more</span>}
                    </div>
                  )}

                  {/* Assignees + Reviewers avatars */}
                  <div className="flex items-center gap-4 text-[12px] text-[#6A7282]">
                    {assigneeMembers.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span>Assigned:</span>
                        <div className="flex -space-x-1.5">
                          {assigneeMembers.slice(0, 4).map(m => <Avatar key={m.userId} name={m.user?.fullName} color="#3B82F6" />)}
                          {assigneeMembers.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E7EB] text-[10px] text-[#4A5565]">+{assigneeMembers.length - 4}</span>}
                        </div>
                      </div>
                    )}
                    {reviewerMembers.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span>Review:</span>
                        <div className="flex -space-x-1.5">
                          {reviewerMembers.slice(0, 4).map(m => <Avatar key={m.userId} name={m.user?.fullName} color="#22C55E" />)}
                          {reviewerMembers.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E7EB] text-[10px] text-[#4A5565]">+{reviewerMembers.length - 4}</span>}
                        </div>
                      </div>
                    )}
                    {cr.attachments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                        </svg>
                        {cr.attachments.length} file{cr.attachments.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span>· {fmtRel(cr.createdAt)}</span>
                  </div>
                </div>

                <button onClick={() => setDetailCR(cr)}
                  className="shrink-0 inline-flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-gray-50 transition-colors"
                >View Details</button>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          projectPublicId={projectPublicId}
          disciplines={disciplines}
          modelFiles={modelFiles}
          teamMembers={teamMembers}
          loadingFiles={loadingFiles}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {detailCR && (
        <DetailModal
          cr={detailCR}
          disciplines={disciplines}
          modelFiles={modelFiles}
          teamMembers={teamMembers}
          onClose={() => setDetailCR(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
