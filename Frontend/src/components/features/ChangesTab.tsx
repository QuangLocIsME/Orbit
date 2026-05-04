'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTodayLocalDateString, localDateStringToUTCDate, utcDateStringToLocalDateString } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { refreshApiCache } from '@/lib/sw-utils';
import { getProjectTabCache, mergeProjectTabCache } from '@/stores/projectDetailCacheStore';
import { FileIcon, fmtSize, MAX_ATTACH_SIZE, Avatar } from './TaskFormShared';
import { MemberPicker, AttachPicker } from './TaskFormShared';
import { CommentSection, type CommentItem } from './TaskFormShared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

interface StructuredSections {
  context: string;
  problem: string;
  proposedChange: string;
  impact: {
    estimatedImpact: 'low' | 'medium' | 'high' | null;
    affectedModels: string[];
    clashCheckRequired: boolean;
  };
}

interface ResultAttachment {
  name: string;
  size: number;
  url: string;
  mimeType: string;
  sourceDocumentId: string;
}

interface ChangeRequest {
  publicId: string;
  crId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'approved' | 'completed' | 'published' | 'rejected';
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
  // New fields
  linkedTaskIds: string[];
  primaryTaskId: string | null;
  affectedDocuments: string[];
  derivedPackageIds: string[];
  structuredSections: StructuredSections | null;
  resultAttachments: ResultAttachment[];
}

interface LinkedTask {
  id?: string;
  publicId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string;
  assigneeIds: string[];
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  affectedModels?: string[];
}

interface CRVersion {
  publicId: string;
  crId: string;
  versionNumber: number;
  versionLabel: string;
  snapshot: {
    title: string;
    description: string;
    priority: string;
    estimatedImpact: string | null;
    affectedModels: string[];
    disciplineId: string | null;
    attachments: Attachment[];
    structuredSections: StructuredSections | null;
    taskIds: string[];
    completedBy: string;
    completedAt: string;
  };
  resultFiles: ResultAttachment[];
  createdAt: string;
}

interface Discipline { id: string; name: string; color: string; description: string; }
interface ModelFile  { id: string; name: string; size?: number; folderPath?: string; }
interface TeamMember { publicId: string; userId: string; role: string; status: string; user: { fullName: string; email: string; avatar?: string } | null; }
interface ChangesTabProps { 
  projectPublicId: string; 
  onActivityAdded?: () => void;
  initialCrId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:       { label: 'Pending',      bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]' },
  'in-progress': { label: 'In Progress', bg: 'bg-[#EEF2FF]', text: 'text-[#432DD7]' },
  approved:      { label: 'Approved',     bg: 'bg-[#ECFDF5]', text: 'text-[#007A55]' },
  completed:     { label: 'Completed',     bg: 'bg-[#10B981]', text: 'text-white' },
  published:     { label: 'Published',     bg: 'bg-[#059669]', text: 'text-white' },
  rejected:      { label: 'Rejected',     bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
} as const;

const PRIORITY_CFG = {
  urgent: { label: 'Urgent', bg: 'bg-[#FFF1F2]', text: 'text-[#C70036]' },
  high:   { label: 'High',   bg: 'bg-[#FFF1F2]', text: 'text-[#C70036]' },
  medium: { label: 'Medium', bg: 'bg-[#F0F9FF]',  text: 'text-[#0069A8]' },
  low:    { label: 'Low',    bg: 'bg-[#F3F4F6]',  text: 'text-[#364153]' },
} as const;

const ICON_BG     = { pending:'bg-[#EEF2FF]', 'in-progress':'bg-[#EEF2FF]', approved:'bg-[#ECFDF5]', completed:'bg-[#10B981]/10', published:'bg-[#059669]/10', rejected:'bg-[#FEE2E2]' } as const;
const ICON_STROKE = { pending:'#4F39F6', 'in-progress':'#4F39F6', approved:'#009966', completed:'#10B981', published:'#059669', rejected:'#DC2626' } as const;
const MODEL_EXT = /\.(ifc|rvt|dwg|dxf|nwd|nwf|nwc|skp|fbx|obj|3ds|step|stp)$/i;

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
  const [proposedChange, setProposedChange]      = useState('');
  const [estimatedCost, setEstimatedCost]         = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [deadline, setDeadline]                   = useState('');
  const [disciplineId, setDisciplineId]          = useState('');
  const [affectedModels, setAffectedModels]      = useState<string[]>([]);
  const [clashCheckRequired, setClashCheckRequired] = useState(false);
  const [assignedTo, setAssignedTo]               = useState<string[]>([]);
  const [reviewers, setReviewers]                 = useState<string[]>([]);
  const [attachments, setAttachments]              = useState<File[]>([]);
  const [submitting, setSubmitting]               = useState(false);

  const toggleModel = (id: string) =>
    setAffectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!title.trim())       { toast.error('Title is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!estimatedImpact)    { toast.error('Estimated Impact is required'); return; }

    const structuredSections = {
      context: description.trim(),
      problem: detailedDescription.trim(),
      proposedChange: proposedChange.trim(),
      impact: {
        estimatedImpact: estimatedImpact as 'low' | 'medium' | 'high' | null,
        affectedModels,
        clashCheckRequired,
      },
    };

    setSubmitting(true);
    try {
      let res: Response;
      if (attachments.length > 0) {
        const form = new FormData();
        form.append('title', title.trim());
        form.append('description', description.trim());
        form.append('priority', priority);
        form.append('estimatedImpact', estimatedImpact);
        if (detailedDescription.trim()) form.append('detailedDescription', detailedDescription.trim());
        if (proposedChange.trim()) form.append('proposedChange', proposedChange.trim());
        if (estimatedCost.trim()) form.append('estimatedCost', estimatedCost.trim());
        if (estimatedDuration.trim()) form.append('estimatedDuration', estimatedDuration.trim());
        if (deadline) form.append('deadline', localDateStringToUTCDate(deadline));
        if (disciplineId) form.append('disciplineId', disciplineId);
        if (clashCheckRequired) form.append('clashCheckRequired', 'true');
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
            proposedChange: proposedChange.trim() || undefined,
            estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : undefined,
            estimatedDuration: estimatedDuration.trim() || undefined,
            deadline: deadline ? localDateStringToUTCDate(deadline) : undefined,
            disciplineId: disciplineId || null,
            affectedModels,
            assignedTo,
            reviewers,
            clashCheckRequired,
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

          {/* ── Section 1: Context ─────────────────────────────────── */}
          <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#155DFC]" />
              <h3 className="text-[14px] font-semibold text-[#101828]">Context</h3>
            </div>
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
          </div>

          {/* ── Section 2: Problem ──────────────────────────────────── */}
          <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#F59E0B]" />
              <h3 className="text-[14px] font-semibold text-[#101828]">Problem</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Detailed Description <span className="text-[12px] font-normal text-[#6A7282]">(optional)</span></label>
              <textarea
                placeholder="Provide a thorough explanation of the change, its rationale, and expected outcomes..."
                value={detailedDescription}
                onChange={e => setDetailedDesc(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>
          </div>

          {/* ── Section 3: Proposed Change ───────────────────────────── */}
          <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#10B981]" />
              <h3 className="text-[14px] font-semibold text-[#101828]">Proposed Change</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">What should be changed and how? <span className="text-[12px] font-normal text-[#6A7282]">(optional)</span></label>
              <textarea
                placeholder="Describe the specific change to be made, including scope, approach, and expected result..."
                value={proposedChange}
                onChange={e => setProposedChange(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none"
              />
            </div>
          </div>

          {/* ── Section 4: Impact ──────────────────────────────────── */}
          <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-[#F43F5E]" />
              <h3 className="text-[14px] font-semibold text-[#101828]">Impact</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium text-[#101828]">Priority <span className="text-[#FF2056]">*</span></label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={cn('h-9 rounded-[8px] text-[13px] capitalize transition-colors border',
                        priority === p ? 'bg-[#F0F9FF] border-[#155DFC] text-[#0069A8]' : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                      )}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium text-[#101828]">Estimated Impact <span className="text-[#FF2056]">*</span></label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { val: 'low',    label: 'Low',    active: 'bg-[#F0FDF4] border-[#22C55E] text-[#15803D]', dot: 'bg-[#22C55E]' },
                    { val: 'medium', label: 'Medium', active: 'bg-[#FFFBEB] border-[#F59E0B] text-[#B45309]', dot: 'bg-[#F59E0B]' },
                    { val: 'high',   label: 'High',   active: 'bg-[#FFF1F2] border-[#F43F5E] text-[#C70036]', dot: 'bg-[#F43F5E]' },
                  ] as const).map(({ val, label, active, dot }) => (
                    <button key={val} type="button" onClick={() => setEstimatedImpact(val)}
                      className={cn('h-9 rounded-[8px] text-[13px] font-medium transition-colors border flex items-center justify-center gap-1.5',
                        estimatedImpact === val ? active : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                      )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', estimatedImpact === val ? dot : 'bg-[#D1D5DC]')} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setClashCheckRequired(v => !v)}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', clashCheckRequired ? 'bg-[#155DFC]' : 'bg-[#D1D5DC]')}>
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', clashCheckRequired ? 'translate-x-6' : 'translate-x-1')} />
              </button>
              <span className="text-[14px] text-[#364153]">Clash check required after change</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Affected Models</label>
              {loadingFiles ? (
                <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">Loading model files...</div>
              ) : modelFiles.length === 0 ? (
                <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">No model files found.</div>
              ) : (
                <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[140px] overflow-y-auto">
                  {modelFiles.map(f => (
                    <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
                      <input type="checkbox" checked={affectedModels.includes(f.id)} onChange={() => toggleModel(f.id)}
                        className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]" />
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
                        <button type="button" onClick={() => toggleModel(id)} className="ml-0.5 text-[#93C5FD] hover:text-[#1D4ED8] font-bold">x</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Assignees + Reviewers — 2 col ─────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <MemberPicker label="Assigned To" members={teamMembers} selected={assignedTo} onChange={setAssignedTo} />
            <MemberPicker label="Reviewers"   members={teamMembers} selected={reviewers}  onChange={setReviewers}  />
          </div>

          {/* ── Estimated Cost + Duration — 2 col ─────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Cost</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#6A7282] select-none">$</span>
                <input type="number" min={0} placeholder="0.00" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-7 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Duration</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <input type="text" placeholder="e.g. 2 weeks" value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-9 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]" />
              </div>
            </div>
          </div>

          {/* ── Deadline + Discipline — 2 col ──────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                min={getTodayLocalDateString()}
                className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Discipline</label>
              {disciplines.length === 0 ? (
                <p className="text-[13px] text-[#6A7282] mt-1">No disciplines — add in <strong>Settings</strong>.</p>
              ) : (
                <select value={disciplineId} onChange={e => setDisciplineId(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]">
                  <option value="">Select discipline...</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* ── Attachments ─────────────────────────────────────── */}
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  cr: ChangeRequest;
  disciplines: Discipline[];
  modelFiles: ModelFile[];
  teamMembers: TeamMember[];
  loadingFiles: boolean;
  onClose: () => void;
  onUpdated: (cr: ChangeRequest) => void;
}

function EditModal({ cr, disciplines, modelFiles, teamMembers, loadingFiles, onClose, onUpdated }: EditModalProps) {
  const [title, setTitle]                         = useState(cr.title);
  const [description, setDescription]             = useState(cr.description);
  const [priority, setPriority]                   = useState<ChangeRequest['priority']>(cr.priority);
  const [estimatedImpact, setEstimatedImpact]     = useState<'low' | 'medium' | 'high' | ''>(cr.estimatedImpact ?? '');
  const [detailedDescription, setDetailedDesc]    = useState(cr.detailedDescription ?? '');
  const [estimatedCost, setEstimatedCost]         = useState(cr.estimatedCost != null ? String(cr.estimatedCost) : '');
  const [estimatedDuration, setEstimatedDuration] = useState(cr.estimatedDuration ?? '');
  const [deadline, setDeadline]                   = useState(cr.deadline ? utcDateStringToLocalDateString(cr.deadline) : '');
  const [disciplineId, setDisciplineId]           = useState(cr.disciplineId ?? '');
  const [affectedModels, setAffectedModels]       = useState<string[]>(cr.affectedModels);
  const [assignedTo, setAssignedTo]               = useState<string[]>(cr.assignedTo);
  const [reviewers, setReviewers]                 = useState<string[]>(cr.reviewers);
  const [submitting, setSubmitting]               = useState(false);

  const toggleModel = (id: string) =>
    setAffectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!title.trim())    { toast.error('Title is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!estimatedImpact) { toast.error('Estimated Impact is required'); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/change-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crId: cr.publicId,
          title: title.trim(),
          description: description.trim(),
          priority,
          estimatedImpact,
          detailedDescription: detailedDescription.trim() || undefined,
          estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : null,
          estimatedDuration: estimatedDuration.trim() || undefined,
          deadline: deadline ? localDateStringToUTCDate(deadline) : null,
          disciplineId: disciplineId || null,
          affectedModels,
          assignedTo,
          reviewers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Change request updated');
        onUpdated({ ...cr, ...data.data });
        onClose();
      } else {
        toast.error(data.message || 'Failed to update change request');
      }
    } catch {
      toast.error('Failed to update change request');
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
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#FFFBEB]">
              <svg className="h-5 w-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828]">Edit Change Request</h2>
              <p className="text-[12px] text-[#6A7282]"><span className="font-mono">{cr.crId}</span> · {cr.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#6A7282] hover:text-gray-700 rounded-[10px] hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body — reuse exact same field layout as CreateModal */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Title <span className="text-[#FF2056]">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]" />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Priority <span className="text-[#FF2056]">*</span></label>
            <div className="grid grid-cols-4 gap-2">
              {(['low','medium','high','urgent'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={cn('h-10 rounded-[10px] text-[14px] capitalize transition-colors border',
                    priority === p ? 'bg-[#F0F9FF] border-[#155DFC] text-[#0069A8]' : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                  )}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
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
                <button key={val} type="button" onClick={() => setEstimatedImpact(val)}
                  className={cn('h-10 rounded-[10px] text-[14px] font-medium transition-colors border flex items-center justify-center gap-2',
                    estimatedImpact === val ? active : 'bg-white border-[#E5E7EB] text-[#4A5565] hover:bg-gray-50'
                  )}>
                  <span className={cn('h-2 w-2 rounded-full', estimatedImpact === val ? dot : 'bg-[#D1D5DC]')} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Description <span className="text-[#FF2056]">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none" />
          </div>

          {/* Detailed Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Detailed Description <span className="text-[12px] font-normal text-[#6A7282]">(optional)</span></label>
            <textarea value={detailedDescription} onChange={e => setDetailedDesc(e.target.value)} rows={4}
              placeholder="Provide a thorough explanation..."
              className="w-full rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] resize-none" />
          </div>

          {/* Cost + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Cost</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#6A7282] select-none">$</span>
                <input type="number" min={0} placeholder="0.00" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-7 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Estimated Duration</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6A7282]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <input type="text" placeholder="e.g. 2 weeks" value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] pl-9 pr-4 text-[14px] text-[#101828] placeholder:text-[#6A7282] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]" />
              </div>
            </div>
          </div>

          {/* Deadline + Discipline */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                min={getTodayLocalDateString()}
                className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC] [color-scheme:light]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#101828]">Discipline</label>
              {disciplines.length === 0 ? (
                <p className="text-[13px] text-[#6A7282] mt-1">No disciplines — add in <strong>Settings</strong>.</p>
              ) : (
                <select value={disciplineId} onChange={e => setDisciplineId(e.target.value)}
                  className="w-full h-[38px] rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#101828] focus:border-[#155DFC] focus:outline-none focus:ring-1 focus:ring-[#155DFC]">
                  <option value="">Select discipline...</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Assignees + Reviewers */}
          <div className="grid grid-cols-2 gap-4">
            <MemberPicker label="Assigned To" members={teamMembers} selected={assignedTo} onChange={setAssignedTo} />
            <MemberPicker label="Reviewers"   members={teamMembers} selected={reviewers}  onChange={setReviewers}  />
          </div>

          {/* Affected Models */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#101828]">Affected Models</label>
            {loadingFiles ? (
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">Loading…</div>
            ) : modelFiles.length === 0 ? (
              <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#6A7282]">No model files found.</div>
            ) : (
              <div className="rounded-[10px] border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6] max-h-[160px] overflow-y-auto">
                {modelFiles.map(f => (
                  <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB]">
                    <input type="checkbox" checked={affectedModels.includes(f.id)} onChange={() => toggleModel(f.id)}
                      className="h-4 w-4 rounded border-[#D1D5DC] accent-[#155DFC]" />
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#F59E0B] px-5 py-2 text-[14px] font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-60">
            {submitting ? (
              <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving…</>
            ) : (
              <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({ cr, onClose, onDeleted }: {
  cr: ChangeRequest;
  onClose: () => void;
  onDeleted: (publicId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch('/api/change-requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId: cr.publicId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast.success('Change request deleted');
        onDeleted(cr.publicId);
        onClose();
      } else {
        if (res.status === 403) {
          toast.error('You do not have permission to delete this change request.');
        } else {
          toast.error(data?.message || 'Failed to delete change request');
        }
      }
    } catch {
      toast.error('Failed to delete change request');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-[420px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
            <svg className="h-5 w-5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-semibold text-[#101828]">Delete Change Request</h3>
            <p className="text-[13px] text-[#6A7282] mt-1">
              Are you sure you want to delete <span className="font-medium text-[#101828]">"{cr.title}"</span> (<span className="font-mono">{cr.crId}</span>)? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-[#364153] hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#DC2626] text-[14px] font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60">
            {deleting ? (
              <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Deleting…</>
            ) : (
              <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  cr, disciplines, modelFiles, teamMembers, projectPublicId, currentUserId, currentRole, workflowStages, onClose, onStatusChange, onTaskLinked, onTaskUnlinked, onRefreshCR,
}: {
  cr: ChangeRequest;
  disciplines: Discipline[];
  modelFiles: ModelFile[];
  teamMembers: TeamMember[];
  projectPublicId: string;
  currentUserId: string;
  currentRole: 'admin' | 'member' | 'viewer';
  workflowStages?: { id: string; name: string; color?: string }[];
  onClose: () => void;
  onStatusChange: (id: string, s: ChangeRequest['status']) => void;
  onTaskLinked?: (taskId: string) => void;
  onTaskUnlinked?: (taskId: string) => void;
  onRefreshCR?: (freshCR: ChangeRequest) => void;
}) {
  const [updating, setUpdating] = useState(false);

  // ── Task linking state ─────────────────────────────────────────────────────────
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [showLinkTask, setShowLinkTask] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<LinkedTask[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [linkingTask, setLinkingTask] = useState(false);

  // ── Version history state ─────────────────────────────────────────────────────
  const [versions, setVersions] = useState<CRVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  const disc = disciplines.find(d => d.id === cr.disciplineId);
  const sc = STATUS_CFG[cr.status] ?? { label: cr.status, bg: 'bg-gray-100', text: 'text-gray-700' };
  const pc = PRIORITY_CFG[cr.priority] ?? { label: cr.priority, bg: 'bg-gray-100', text: 'text-gray-700' };

  const resolveTaskStatusLabel = (status: string) => {
    const stage = (workflowStages || []).find(s => s.id === status);
    return stage ? stage.name : status;
  };

  // Permission: only admin or CR creator can update status
  const isCreator = cr.createdBy === currentUserId;
  const canUpdateStatus = currentRole === 'admin' || isCreator;
  const canEdit = currentRole === 'admin' || isCreator;

  // ── Load linked tasks ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cr.linkedTaskIds || cr.linkedTaskIds?.length === 0) {
      setLinkedTasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTasks(true);
      try {
        const res = await apiFetch('/api/tasks/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        });
        if (res.ok && !cancelled) {
          const d = await res.json();
          const allTasks: LinkedTask[] = d?.data ?? [];
          const linked = allTasks.filter(t => cr.linkedTaskIds?.includes(t.id || t.publicId));
          if (!cancelled) setLinkedTasks(linked);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingTasks(false); }
    })();
    return () => { cancelled = true; };
  }, [cr.linkedTaskIds, projectPublicId]);

  // ── Reload CR data on mount to get fresh linkedTaskIds ──────────────────────
  // Tasks can be linked via CreateTaskModal (ScopedTasksPanel), which updates the
  // backend CR but not the parent's cached detailCR. Fetch fresh CR data here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/change-requests/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ crId: cr.publicId, projectId: projectPublicId }),
        });
        if (res.ok && !cancelled) {
          const d = await res.json();
          const fresh = d?.data;
          if (fresh && onRefreshCR) {
            onRefreshCR(fresh);
          }
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []); // run once on mount only

  // ── Load version history ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVersions(true);
      try {
        const res = await apiFetch(`/api/change-requests/${cr.publicId}/versions`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setVersions(Array.isArray(d?.data) ? d.data : []);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingVersions(false); }
    })();
    return () => { cancelled = true; };
  }, [cr.publicId]);

  // ── Load available tasks for linking ─────────────────────────────────────────
  useEffect(() => {
    if (!showLinkTask) return;
    let cancelled = false;
    (async () => {
      setLoadingAvailable(true);
      try {
        const res = await apiFetch('/api/tasks/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        });
        if (res.ok && !cancelled) {
          const d = await res.json();
          const allTasks: LinkedTask[] = d?.data ?? [];
          const available = allTasks.filter(t => !cr.linkedTaskIds?.includes(t.publicId));
          if (!cancelled) setAvailableTasks(available);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, [showLinkTask, projectPublicId, cr.linkedTaskIds]);

  const handleStatus = async (status: ChangeRequest['status']) => {
    setUpdating(true);
    try {
      const res = await apiFetch('/api/change-requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId: cr.publicId, status }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Status → ${STATUS_CFG[status].label}`); onStatusChange(cr.publicId, status); }
      else toast.error(data.message || 'Failed to update');
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  };

  // ── Task linking handlers ─────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) { toast.error('Task title is required'); return; }
    setCreatingTask(true);
    try {
      const res = await apiFetch('/api/change-requests/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crId: cr.publicId,
          taskTitle: newTaskTitle.trim(),
          taskDescription: newTaskDescription.trim(),
          assigneeIds: newTaskAssignees,
          dueDate: newTaskDueDate || undefined,
          affectedModels: cr.affectedModels,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Task created and linked to CR');
        const newTask: LinkedTask = {
          id: data.data.task.id,
          publicId: data.data.task.publicId || data.data.task.id,
          title: data.data.task.title,
          description: data.data.task.description,
          status: data.data.task.status,
          priority: data.data.task.priority,
          assigneeId: data.data.task.assigneeId,
          assigneeIds: data.data.task.assigneeIds,
          dueDate: data.data.task.dueDate,
          createdBy: data.data.task.createdBy,
          createdAt: data.data.task.createdAt,
          affectedModels: data.data.task.affectedModels,
        };
        setLinkedTasks(prev => [...prev, newTask]);
        // Remove from availableTasks so it doesn't still show in "Link Existing" panel
        setAvailableTasks(prev => prev.filter(t => (t.id || t.publicId) !== data.data.task.publicId));
        // Notify other components (e.g., Stage board) that a task was created
        window.dispatchEvent(new CustomEvent('task-created', { detail: { task: newTask } }));
        onStatusChange(cr.publicId, cr.status); // refresh parent
        setShowCreateTask(false);
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskAssignees([]);
        setNewTaskDueDate('');
      } else {
        toast.error(data.message || 'Failed to create task');
      }
    } catch { toast.error('Failed to create task'); }
    finally { setCreatingTask(false); }
  };

  const handleLinkTask = async (taskId: string) => {
    setLinkingTask(true);
    try {
      const res = await apiFetch('/api/change-requests/link-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId: cr.publicId, taskId }),
      });
      const data = await res.json();
      if (data.success) {
        const taskToLink = availableTasks.find(t => (t.id || t.publicId) === taskId);
        if (taskToLink) setLinkedTasks(prev => [...prev, taskToLink]);
        setAvailableTasks(prev => prev.filter(t => (t.id || t.publicId) !== taskId));
        toast.success('Task linked to CR');
        onStatusChange(cr.publicId, cr.status);
        onTaskLinked?.(taskId);
      } else {
        toast.error(data.message || 'Failed to link task');
      }
    } catch { toast.error('Failed to link task'); }
    finally { setLinkingTask(false); }
  };

  const handleUnlinkTask = async (taskId: string) => {
    try {
      const res = await apiFetch('/api/change-requests/unlink-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId: cr.publicId, taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setLinkedTasks(prev => prev.filter(t => (t.id || t.publicId) !== taskId));
        toast.success('Task unlinked from CR');
        onTaskUnlinked?.(taskId);
        onStatusChange(cr.publicId, cr.status);
      } else {
        toast.error(data.message || 'Failed to unlink task');
      }
    } catch { toast.error('Failed to unlink task'); }
  };

  // ── Version handlers ─────────────────────────────────────────────────────────

  const handleCreateVersion = async () => {
    setCreatingVersion(true);
    try {
      const res = await apiFetch(`/api/change-requests/${cr.publicId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectPublicId,
          versionLabel: versionLabel.trim() || `${cr.crId} v1`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Version snapshot created');
        setVersions(prev => [data.data, ...prev]);
        setShowCreateVersion(false);
        setVersionLabel('');
      } else {
        toast.error(data.message || 'Failed to create version');
      }
    } catch { toast.error('Failed to create version'); }
    finally { setCreatingVersion(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-[660px] mx-4 bg-white rounded-[10px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] flex flex-col"
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

          {/* ── Section 1: Context ─────────────────────────────────────────── */}
          {cr.structuredSections?.context && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Context</p>
              <p className="text-[14px] text-[#364153] leading-relaxed">{cr.structuredSections?.context}</p>
            </div>
          )}
          {(!cr.structuredSections?.context) && cr.description && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Context</p>
              <p className="text-[14px] text-[#364153] leading-relaxed">{cr.description}</p>
            </div>
          )}

          {/* ── Section 2: Problem ─────────────────────────────────────────── */}
          {(cr.structuredSections?.problem || cr.detailedDescription) && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Problem</p>
              <p className="text-[14px] text-[#364153] leading-relaxed">{cr.structuredSections?.problem || cr.detailedDescription}</p>
            </div>
          )}

          {/* ── Section 3: Proposed Change ───────────────────────────────────── */}
          {cr.structuredSections?.proposedChange && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Proposed Change</p>
              <p className="text-[14px] text-[#364153] leading-relaxed">{cr.structuredSections?.proposedChange}</p>
            </div>
          )}

          {/* ── Meta row: Discipline + Created ──────────────────────────────── */}
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

          {/* ── Assignees + Reviewers ───────────────────────────────────────── */}
          {(cr.assignedTo?.length > 0 || cr.reviewers?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {cr.assignedTo?.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Assigned To</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cr.assignedTo?.map(id => {
                      const m = teamMembers.find(x => x.userId === id);
                      return m ? (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-1 pr-2 py-0.5 text-[12px] text-[#1D4ED8]">
                          <Avatar name={m.user?.fullName} color="#3B82F6" avatarSrc={m.user?.avatar} />{m.user?.fullName}
                        </span>
                      ) : <span key={id} className="text-[12px] text-[#6A7282]">{id}</span>;
                    })}
                  </div>
                </div>
              )}
              {cr.reviewers?.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Reviewers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cr.reviewers?.map(id => {
                      const m = teamMembers.find(x => x.userId === id);
                      return m ? (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] pl-1 pr-2 py-0.5 text-[12px] text-[#166534]">
                          <Avatar name={m.user?.fullName} color="#22C55E" avatarSrc={m.user?.avatar} />{m.user?.fullName}
                        </span>
                      ) : <span key={id} className="text-[12px] text-[#6A7282]">{id}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Section 4: Impact ──────────────────────────────────────────── */}
          {(cr.estimatedImpact || cr.affectedModels?.length > 0 || cr.structuredSections?.impact) && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-2">Impact</p>
              <div className="space-y-2">
                {cr.estimatedImpact && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#364153]">Level:</span>
                    <span className={cn('rounded px-2 py-0.5 text-[12px] font-medium',
                      cr.estimatedImpact === 'low'    ? 'bg-[#F0FDF4] text-[#15803D]' :
                      cr.estimatedImpact === 'medium' ? 'bg-[#FFFBEB] text-[#B45309]' :
                      'bg-[#FFF1F2] text-[#C70036]'
                    )}>{cr.estimatedImpact}</span>
                  </div>
                )}
                {cr.structuredSections?.impact?.clashCheckRequired && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#364153]">Clash Check Required:</span>
                    <span className="rounded px-2 py-0.5 text-[12px] font-medium bg-[#FFF1F2] text-[#C70036]">Yes</span>
                  </div>
                )}
                {cr.affectedModels?.length > 0 && (
                  <div>
                    <span className="text-[13px] text-[#364153]">Affected Models:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cr.affectedModels?.map((id, i) => {
                        const f = modelFiles.find(m => m.id === id);
                        return (
                          <span key={i} className="inline-flex items-center gap-1 rounded-[6px] bg-[#F3F4F6] px-2 py-1 text-[12px] text-[#364153]">
                            <FileIcon className="text-[#6A7282]" />{f ? f.name : id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Attachments ─────────────────────────────────────────────────── */}
          {cr.attachments?.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Attachments</p>
              <div className="rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                {cr.attachments?.map((a, i) => (
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

          {/* ── Section: Linked Tasks ───────────────────────────────────────── */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                <span className="text-sm font-semibold text-foreground">Linked Tasks</span>
                {linkedTasks.length > 0 && (
                  <span className="ml-1 inline-flex h-5 items-center rounded-full bg-[#EEF2FF] px-2 text-[10px] font-medium text-[#432DD7]">{linkedTasks.length}</span>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setNewTaskTitle(`[${cr.crId}] ${cr.title}`); setNewTaskDescription(cr.description); setShowCreateTask(true); }}
                    className="rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                  >
                    + Create Task
                  </button>
                  <button
                    onClick={() => setShowLinkTask(true)}
                    className="rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                  >
                    Link Existing
                  </button>
                </div>
              )}
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center py-4">
                <svg className="h-4 w-4 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            ) : linkedTasks.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/60 text-center py-4">No linked tasks. Create a task or link an existing one to track execution.</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map(task => {
                  const assignee = teamMembers.find(m => m.userId === task.assigneeId || task.assigneeIds?.includes(m.userId));
                  return (
                    <div
                      key={task.publicId}
                      className="flex items-center justify-between rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                      onClick={() => window.location.href = `/projects/${projectPublicId}?tab=tasks&taskId=${task.id || task.publicId}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-[8px] bg-[#EEF2FF] flex items-center justify-center shrink-0">
                          <svg className="h-4 w-4 text-[#432DD7]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#101828] truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[#6A7282]">{resolveTaskStatusLabel(task.status)}</span>
                            {assignee && <span className="text-[11px] text-[#6A7282]">· {assignee.user?.fullName}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnlinkTask(task.id || task.publicId); }}
                          className="text-[#6A7282] hover:text-[#DC2626] text-[16px] leading-none"
                          title="Unlink task"
                        >×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Create Task inline form ────────────────────────────────────── */}
          {showCreateTask && (
            <div className="rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#1D4ED8]">Create Task from CR</p>
              <input type="text" placeholder="Task title" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none" />
              <textarea placeholder="Task description" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} rows={2}
                className="w-full rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] resize-none focus:border-[#155DFC] focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#6A7282] block mb-1">Due Date</label>
                  <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                    min={getTodayLocalDateString()}
                    className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none [color-scheme:light]" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateTask(false)} className="px-3 py-1.5 text-[12px] text-[#364153] hover:text-[#101828]">Cancel</button>
                <button onClick={handleCreateTask} disabled={creatingTask}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#155DFC] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {creatingTask ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : ''}
                  {creatingTask ? 'Creating…' : 'Create & Link'}
                </button>
              </div>
            </div>
          )}

          {/* ── Link Existing Task modal ─────────────────────────────────────── */}
          {showLinkTask && (
            <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#101828]">Link Existing Task</p>
                <button onClick={() => setShowLinkTask(false)} className="text-[#6A7282] hover:text-[#101828] text-[18px] leading-none">×</button>
              </div>
              <input type="text" placeholder="Search tasks…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none" />
              {loadingAvailable ? (
                <div className="flex justify-center py-4"><svg className="h-4 w-4 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                  {availableTasks
                    .filter(t => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(t => (
                      <button key={t.id || t.publicId} onClick={() => handleLinkTask(t.id || t.publicId)}
                        className="w-full flex items-center justify-between rounded-[8px] border border-[#E5E7EB] px-3 py-2.5 text-left hover:bg-[#F9FAFB] transition-colors disabled:opacity-60"
                        disabled={linkingTask}>
                        <div className="min-w-0">
                          <p className="text-[13px] text-[#101828] truncate">{t.title}</p>
                          <p className="text-[11px] text-[#6A7282]">{resolveTaskStatusLabel(t.status)}</p>
                        </div>
                        <span className="text-[#155DFC] text-[12px] shrink-0 ml-2">Link</span>
                      </button>
                    ))
                  }
                  {availableTasks.length === 0 && (
                    <p className="text-[13px] text-[#6A7282] text-center py-4">No available tasks found.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Result Attachments (completed CRs) ──────────────────────────── */}
          {(cr.status === 'completed' || cr.status === 'published') && cr.resultAttachments && cr.resultAttachments.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-1.5">Result Files</p>
              <div className="rounded-[10px] border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                {cr.resultAttachments?.map((a, i) => (
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

          {/* ── Section: Version History ─────────────────────────────────────── */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-sm font-semibold text-foreground">Version History</span>
                {versions.length > 0 && (
                  <span className="ml-1 inline-flex h-5 items-center rounded-full bg-[#ECFDF5] px-2 text-[10px] font-medium text-[#007A55]">{versions.length}</span>
                )}
              </div>
              {canUpdateStatus && (cr.status === 'approved' || cr.status === 'completed') && (
                <button
                  onClick={() => setShowCreateVersion(true)}
                  className="rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                >
                  + Create Version
                </button>
              )}
            </div>

            {loadingVersions ? (
              <div className="flex items-center justify-center py-4">
                <svg className="h-4 w-4 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            ) : versions.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/60 text-center py-4">No versions yet. Mark the CR as completed to create a version snapshot.</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <details key={v.publicId} className="rounded-[8px] border border-[#E5E7EB]">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F9FAFB] list-none">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-[8px] bg-[#ECFDF5] flex items-center justify-center">
                          <svg className="h-4 w-4 text-[#007A55]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#101828]">{v.versionLabel || `Version ${v.versionNumber}`}</p>
                          <p className="text-[11px] text-[#6A7282]">{new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <svg className="h-4 w-4 text-[#6A7282] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </summary>
                    <div className="px-4 pb-4 border-t border-[#F3F4F6] pt-3 space-y-2">
                      {v.snapshot && (
                        <>
                          <p className="text-[12px] font-medium text-[#364153]">{v.snapshot.title}</p>
                          {v.snapshot.description && <p className="text-[12px] text-[#6A7282]">{v.snapshot.description}</p>}
                          {v.snapshot.completedAt && (
                            <p className="text-[11px] text-[#6A7282]">Completed: {new Date(v.snapshot.completedAt).toLocaleDateString()}</p>
                          )}
                        </>
                      )}
                      {v.resultFiles && v.resultFiles.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[11px] font-semibold text-[#6A7282] mb-1">Result Files:</p>
                          {v.resultFiles.map((f, i) => (
                            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-[12px] text-[#155DFC] hover:underline">
                              <FileIcon />{f.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* ── Create Version form ─────────────────────────────────────────── */}
          {showCreateVersion && (
            <div className="rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#1D4ED8]">Create Version Snapshot</p>
              <input type="text" placeholder="Version label (e.g. CR-001 Final)" value={versionLabel}
                onChange={e => setVersionLabel(e.target.value)}
                className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateVersion(false)} className="px-3 py-1.5 text-[12px] text-[#364153]">Cancel</button>
                <button onClick={handleCreateVersion} disabled={creatingVersion}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#007A55] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-green-700 disabled:opacity-60">
                  {creatingVersion ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : ''}
                  {creatingVersion ? 'Creating…' : 'Create Version'}
                </button>
              </div>
            </div>
          )}

          {/* ── Status actions ─────────────────────────────────────────────── */}
          {canUpdateStatus && cr.status !== 'completed' && cr.status !== 'published' && cr.status !== 'rejected' && (
            <div className="border-t border-[#E5E7EB] pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6A7282] mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(['pending','in-progress','approved','completed','published','rejected'] as const)
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
          {!canUpdateStatus && (
            <p className="text-[12px] text-[#99A1AF] border-t border-[#E5E7EB] pt-4">Only admins and the CR creator can update status.</p>
          )}

          {/* ── Comments Section ──────────────────────────────────────────── */}
          <CommentSection
            type="change-request"
            targetId={cr.publicId}
            projectId={projectPublicId}
            currentUserId={currentUserId}
            currentRole={currentRole}
            variant="detail"
          />
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[14px] text-[#364153] hover:text-[#101828] transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChangesTab({ projectPublicId, onActivityAdded, initialCrId }: ChangesTabProps) {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loadingCR, setLoadingCR]           = useState(true);
  const [disciplines, setDisciplines]       = useState<Discipline[]>([]);
  const [modelFiles, setModelFiles]         = useState<ModelFile[]>([]);
  const [teamMembers, setTeamMembers]       = useState<TeamMember[]>([]);
  const [loadingFiles, setLoadingFiles]     = useState(false);
  const [currentUserId, setCurrentUserId]   = useState('');
  const [currentRole, setCurrentRole]       = useState<'admin' | 'member' | 'viewer'>('member');
  const [filter, setFilter]                 = useState<'all'|'pending'|'in-progress'|'approved'|'completed'|'published'>('all');
  const [search, setSearch]                 = useState('');
  const [showCreate, setShowCreate]         = useState(false);
  const [detailCR, setDetailCR]             = useState<ChangeRequest | null>(null);
  const [editCR, setEditCR]                 = useState<ChangeRequest | null>(null);
  const [deleteCR, setDeleteCR]             = useState<ChangeRequest | null>(null);
  const [workflowStages, setWorkflowStages] = useState<{ id: string; name: string; color?: string }[]>([]);

  // Open detail modal when initialCrId is provided via URL
  useEffect(() => {
    if (!initialCrId) return;
    const cr = changeRequests.find(c => c.publicId === initialCrId);
    if (cr) {
      setDetailCR(cr);
    }
  }, [initialCrId, changeRequests]);

  const loadCR = useCallback(async () => {
    setLoadingCR(true);
    try {
      const res = await apiFetch(`/api/projects/${projectPublicId}/change-requests`);
      if (res.ok) {
        const d = await res.json();
        const normalized = (d?.data ?? []).map((cr: ChangeRequest) => ({
          ...cr,
          affectedModels:      Array.isArray(cr.affectedModels)  ? cr.affectedModels  : [],
          assignedTo:          Array.isArray(cr.assignedTo)      ? cr.assignedTo      : [],
          reviewers:           Array.isArray(cr.reviewers)       ? cr.reviewers       : [],
          attachments:         Array.isArray(cr.attachments)     ? cr.attachments     : [],
          estimatedImpact:     cr.estimatedImpact  ?? null,
          estimatedCost:       cr.estimatedCost    ?? null,
          estimatedDuration:   cr.estimatedDuration ?? '',
          deadline:            cr.deadline         ?? null,
          detailedDescription: cr.detailedDescription ?? '',
          linkedTaskIds:       Array.isArray(cr.linkedTaskIds)   ? cr.linkedTaskIds   : [],
          primaryTaskId:       cr.primaryTaskId ?? null,
          affectedDocuments:   Array.isArray(cr.affectedDocuments) ? cr.affectedDocuments : [],
          derivedPackageIds:   Array.isArray(cr.derivedPackageIds) ? cr.derivedPackageIds : [],
          structuredSections:  cr.structuredSections ?? null,
          resultAttachments:   Array.isArray(cr.resultAttachments) ? cr.resultAttachments : [],
        }));
        setChangeRequests(normalized);
      }
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
          body: JSON.stringify({ projectId: projectPublicId, includePackages: true }),
        }),
        apiFetch(`/api/projects/member-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        }),
      ]);
      let nextDisciplines: Discipline[] = [];
      let nextModelFiles: ModelFile[] = [];
      let nextTeamMembers: TeamMember[] = [];
      let nextCurrentUserId = '';
      let nextCurrentRole: 'admin' | 'member' | 'viewer' = 'member';
      let nextWorkflowStages: { id: string; name: string; color?: string }[] = [];

      if (dRes.ok) {
        const d = await dRes.json();
        nextDisciplines = d.data || [];
        setDisciplines(nextDisciplines);
      }
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
        if (tree) {
          nextModelFiles = flatten(tree.children || []);
          setModelFiles(nextModelFiles);
        }
      }
      if (teamRes.ok) {
        const d = await teamRes.json();
        nextTeamMembers = d?.data || [];
        setTeamMembers(nextTeamMembers);
        if (d?.currentUserId) {
          nextCurrentUserId = d.currentUserId;
          setCurrentUserId(d.currentUserId);
        }
        if (d?.currentRole) {
          nextCurrentRole = d.currentRole as 'admin' | 'member' | 'viewer';
          setCurrentRole(nextCurrentRole);
        }
      }
      // Fetch workflow stages for task status labels
      try {
        const wfRes = await apiFetch('/api/projects/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectPublicId }),
        });
        if (wfRes.ok) {
          const wf = await wfRes.json();
          const stages: { id: string; name: string; color?: string }[] = (wf?.data?.stages || []).map((s: any) => ({
            id: String(s.id || ''),
            name: String(s.label || s.name || ''),
            color: s.color || undefined,
          }));
          nextWorkflowStages = stages;
          setWorkflowStages(stages);
        }
      } catch { /* silent */ }

    } catch { /* silent */ }
    finally { setLoadingFiles(false); }
  }, [projectPublicId]);

  useEffect(() => {
    const cached = getProjectTabCache<{
      changeRequests?: ChangeRequest[];
      disciplines?: Discipline[];
      modelFiles?: ModelFile[];
      teamMembers?: TeamMember[];
      currentUserId?: string;
      currentRole?: 'admin' | 'member' | 'viewer';
      workflowStages?: { id: string; name: string; color?: string }[];
    }>(projectPublicId, 'changes');

    if (cached?.data) {
      if (cached.data.changeRequests) setChangeRequests(cached.data.changeRequests);
      if (cached.data.disciplines) setDisciplines(cached.data.disciplines);
      if (cached.data.modelFiles) setModelFiles(cached.data.modelFiles);
      if (cached.data.teamMembers) setTeamMembers(cached.data.teamMembers);
      if (cached.data.currentUserId) setCurrentUserId(cached.data.currentUserId);
      if (cached.data.currentRole) setCurrentRole(cached.data.currentRole);
      if (cached.data.workflowStages) setWorkflowStages(cached.data.workflowStages);
      setLoadingCR(false);
      setLoadingFiles(false);
      loadCR().catch(() => {});
      loadMeta().catch(() => {});
      return;
    }

    loadCR();
    loadMeta();
  }, [loadCR, loadMeta, projectPublicId]);

  useEffect(() => {
    mergeProjectTabCache(projectPublicId, 'changes', {
      changeRequests,
      disciplines,
      modelFiles,
      teamMembers,
      currentUserId,
      currentRole,
      workflowStages,
    });
  }, [changeRequests, currentRole, currentUserId, disciplines, modelFiles, projectPublicId, teamMembers, workflowStages]);

  // WebSocket realtime — use SW refresh pipeline instead of full re-fetch.
  // SW fetches in background, delivers data via postMessage → sw:data event → this component
  // patches state via the sw:data listener below. No loading flicker, no jank.
  useEffect(() => {
    const socket = getSocket();
    socket.emit('project:join', { projectId: projectPublicId });
    const crRoute = `/api/projects/${projectPublicId}/change-requests`;

    // Register CR route with SW so it caches and intercepts fetches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_ROUTES',
        payload: { routes: [crRoute] },
      });
    }

    const handleCrCreated = ({ projectId }: { projectId: string }) => {
      if (projectId !== projectPublicId) return;
      // Optimistic: prepend a placeholder or just let SW refresh deliver fresh data
      refreshApiCache([crRoute]);
    };

    const handleCrUpdated = ({ projectId }: { projectId: string }) => {
      if (projectId !== projectPublicId) return;
      refreshApiCache([crRoute]);
    };

    const handleCrStatusChanged = ({ projectId }: { projectId: string }) => {
      if (projectId !== projectPublicId) return;
      refreshApiCache([crRoute]);
    };

    const handleCrDeleted = ({ projectId }: { projectId: string }) => {
      if (projectId !== projectPublicId) return;
      refreshApiCache([crRoute]);
    };

    const dispatchCommentsToDetail = (crId: string) => {
      fetch(`/api/change-requests/comments/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crId, projectId: projectPublicId }),
      })
        .then(r => r.json())
        .then(d => {
          const list: CommentItem[] = (Array.isArray(d?.data) ? d.data : []).map((c: any) => ({
            id: String(c.publicId || c.id || Math.random()),
            authorId: String(c.authorId || c.author?._id || ''),
            authorName: String(c.authorName || c.author?.fullName || c.author?.name || 'Unknown'),
            avatar: c.avatar || c.author?.avatar || null,
            content: String(c.content || ''),
            createdAt: String(c.createdAt || ''),
            updatedAt: c.updatedAt ? String(c.updatedAt) : undefined,
            isEdited: Boolean(c.isEdited),
          }));
          window.dispatchEvent(new CustomEvent('orbit:comments:/api/change-requests/comments/list', { detail: list }));
        })
        .catch(() => {});
    };

    const handleCrCommentAdded = ({ projectId, crId, comment }: { projectId: string; crId: string; comment?: { publicId: string; authorId: string; authorName: string; avatar?: string | null; content: string; createdAt: string; updatedAt?: string; isEdited?: boolean } }) => {
      if (projectId !== projectPublicId) return;
      if (detailCR?.publicId !== crId) return;
      if (!comment) {
        dispatchCommentsToDetail(crId);
        return;
      }

      const incoming: CommentItem = {
        id: String(comment.publicId),
        authorId: String(comment.authorId || ''),
        authorName: String(comment.authorName || 'Unknown'),
        avatar: comment.avatar || null,
        content: String(comment.content || ''),
        createdAt: String(comment.createdAt || ''),
        updatedAt: comment.updatedAt ? String(comment.updatedAt) : undefined,
        isEdited: Boolean(comment.isEdited),
      };

      window.dispatchEvent(new CustomEvent('orbit:comments:/api/change-requests/comments/list', { detail: [incoming] }));
    };

    const handleCrCommentChanged = ({ projectId, crId }: { projectId: string; crId: string }) => {
      if (projectId !== projectPublicId) return;
      if (detailCR?.publicId !== crId) return;
      dispatchCommentsToDetail(crId);
    };

    const handleMetaChanged = ({ projectId }: { projectId: string }) => {
      if (projectId !== projectPublicId) return;
      loadMeta();
    };

    const handleProjectUpdated = ({ projectId, changes }: { projectId: string; changes?: Record<string, unknown> }) => {
      if (projectId !== projectPublicId) return;
      const update = changes || {};
      if ('workflow' in update || 'workflowTemplateId' in update || 'taskTags' in update || 'settings' in update) {
        loadMeta();
      }
    };

    socket.on('cr:created', handleCrCreated);
    socket.on('cr:updated', handleCrUpdated);
    socket.on('cr:status-changed', handleCrStatusChanged);
    socket.on('cr:deleted', handleCrDeleted);
    socket.on('cr:comment_added', handleCrCommentAdded);
    socket.on('cr:comment_updated', handleCrCommentChanged);
    socket.on('cr:comment_deleted', handleCrCommentChanged);
    socket.on('cr:version_created', handleCrUpdated);
    socket.on('cr:version_updated', handleCrUpdated);
    socket.on('disciplines:changed', handleMetaChanged);
    socket.on('project:member:joined', handleMetaChanged);
    socket.on('project:member:left', handleMetaChanged);
    socket.on('project:member:role-updated', handleMetaChanged);
    socket.on('project:workflow-updated', handleMetaChanged);
    socket.on('project:updated', handleProjectUpdated);

    return () => {
      socket.off('cr:created', handleCrCreated);
      socket.off('cr:updated', handleCrUpdated);
      socket.off('cr:status-changed', handleCrStatusChanged);
      socket.off('cr:deleted', handleCrDeleted);
      socket.off('cr:comment_added', handleCrCommentAdded);
      socket.off('cr:comment_updated', handleCrCommentChanged);
      socket.off('cr:comment_deleted', handleCrCommentChanged);
      socket.off('cr:version_created', handleCrUpdated);
      socket.off('cr:version_updated', handleCrUpdated);
      socket.off('disciplines:changed', handleMetaChanged);
      socket.off('project:member:joined', handleMetaChanged);
      socket.off('project:member:left', handleMetaChanged);
      socket.off('project:member:role-updated', handleMetaChanged);
      socket.off('project:workflow-updated', handleMetaChanged);
      socket.off('project:updated', handleProjectUpdated);
      socket.emit('project:leave', { projectId: projectPublicId });
    };
  }, [projectPublicId, loadMeta, detailCR?.publicId]);

  // ── SW Data Listener ─────────────────────────────────────────────────────────
  // Listen for SW-delivered CR data and patch state directly — no loading state needed.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const crRoute = `/api/projects/${projectPublicId}/change-requests`;

    const handleSWData = (e: Event) => {
      const { route, data } = (e as CustomEvent<{ route: string; data: unknown; isStale: boolean }>).detail;
      if (!route || !route.includes(projectPublicId) || !route.includes('change-requests')) return;

      const crs = Array.isArray(data) ? data : (data as any)?.data;
      if (!Array.isArray(crs)) return;

      setChangeRequests(crs);
      setFilter('all');
    };

    window.addEventListener('sw:data', handleSWData);
    return () => window.removeEventListener('sw:data', handleSWData);
  }, [projectPublicId]);

  const filtered = changeRequests.filter(cr => {
    if (filter === 'pending'      && cr.status !== 'pending')      return false;
    if (filter === 'in-progress'  && cr.status !== 'in-progress')  return false;
    if (filter === 'approved'     && cr.status !== 'approved')     return false;
    if (filter === 'completed'    && cr.status !== 'completed')    return false;
    if (filter === 'published'    && cr.status !== 'published')    return false;
    if (search) {
      const q = search.toLowerCase();
      return cr.title?.toLowerCase().includes(q) || cr.crId?.toLowerCase().includes(q) || cr.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleUpdated = (updated: ChangeRequest) => {
    setChangeRequests(p => p.map(c => c.publicId === updated.publicId ? updated : c));
    if (detailCR?.publicId === updated.publicId) setDetailCR(updated);
  };

  const handleDeleted = (publicId: string) => {
    setChangeRequests(p => p.filter(c => c.publicId !== publicId));
    if (detailCR?.publicId === publicId) setDetailCR(null);
  };

  const handleCreated = (cr: ChangeRequest) => {
    // Normalize all array fields so the list never crashes on missing data
    const safe: ChangeRequest = {
      ...cr,
      affectedModels:      Array.isArray(cr.affectedModels)      ? cr.affectedModels      : [],
      assignedTo:         Array.isArray(cr.assignedTo)         ? cr.assignedTo         : [],
      reviewers:           Array.isArray(cr.reviewers)           ? cr.reviewers           : [],
      attachments:        Array.isArray(cr.attachments)         ? cr.attachments         : [],
      estimatedImpact:    cr.estimatedImpact ?? null,
      estimatedCost:      cr.estimatedCost   ?? null,
      estimatedDuration:  cr.estimatedDuration ?? '',
      deadline:          cr.deadline        ?? null,
      detailedDescription: cr.detailedDescription ?? '',
      linkedTaskIds:     Array.isArray(cr.linkedTaskIds)     ? cr.linkedTaskIds     : [],
      primaryTaskId:      cr.primaryTaskId ?? null,
      affectedDocuments:  Array.isArray(cr.affectedDocuments) ? cr.affectedDocuments : [],
      derivedPackageIds:  Array.isArray(cr.derivedPackageIds) ? cr.derivedPackageIds : [],
      structuredSections: cr.structuredSections ?? null,
      resultAttachments:  Array.isArray(cr.resultAttachments) ? cr.resultAttachments : [],
    };
    setChangeRequests(p => [safe, ...p]);
    // Notify parent to refresh activities
    if (typeof onActivityAdded === 'function') onActivityAdded();
  };
  const handleStatusChange = (id: string, status: ChangeRequest['status']) => {
    setChangeRequests(p => p.map(c => c.publicId === id ? { ...c, status } : c));
    setDetailCR(p => p?.publicId === id ? { ...p, status } : p);
  };

  const total      = changeRequests.length;
  const pending    = changeRequests.filter(c => c.status === 'pending').length;
  const inProgress = changeRequests.filter(c => c.status === 'in-progress').length;
  const approved   = changeRequests.filter(c => c.status === 'approved' || c.status === 'completed' || c.status === 'published').length;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-normal text-[#101828]">Change Requests</h2>
        {currentRole !== 'viewer' && (
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#155DFC] h-10 px-5 min-w-[150px] text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          New Request
        </button>
        )}
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
          {(['all','pending','in-progress','approved','completed','published'] as const).map(f => (
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
              <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#155DFC] px-5 min-w-[150px] py-2 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors">New Request</button>
            )}
          </div>
        ) : (
          filtered.map((cr, idx) => {
            const sc   = STATUS_CFG[cr.status] ?? { label: cr.status, bg: 'bg-gray-100', text: 'text-gray-700' };
            const pc   = PRIORITY_CFG[cr.priority] ?? { label: cr.priority, bg: 'bg-gray-100', text: 'text-gray-700' };
            const disc = disciplines.find(d => d.id === cr.disciplineId);
            const assigneeMembers  = cr.assignedTo?.map(id => teamMembers.find(m => m.publicId === id || m.userId === id)).filter(Boolean) as TeamMember[];
            const reviewerMembers  = cr.reviewers?.map(id => teamMembers.find(m => m.publicId === id || m.userId === id)).filter(Boolean) as TeamMember[];
            const canEdit = currentRole === 'admin' || cr.createdBy === currentUserId;

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
                  {cr.affectedModels?.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="text-[11px] text-[#6A7282]">Models:</span>
                      {cr.affectedModels?.slice(0, 3).map((id, i) => {
                        const f = modelFiles.find(m => m.id === id);
                        return <span key={i} className="inline-flex items-center gap-1 rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#4A5565]"><FileIcon />{f ? f.name : id}</span>;
                      })}
                      {cr.affectedModels?.length > 3 && <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6A7282]">+{cr.affectedModels?.length - 3} more</span>}
                    </div>
                  )}

                  {/* Assignees + Reviewers with full names */}
                  <div className="flex flex-col gap-2 mt-1">
                    {assigneeMembers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium text-[#6A7282] w-[56px] shrink-0">Assigned:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {assigneeMembers.slice(0, 4).map(m => (
                            <span key={m.userId} className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] pl-0.5 pr-2.5 py-0.5 text-[11px] text-[#1D4ED8]">
                              <Avatar name={m.user?.fullName} color="#3B82F6" avatarSrc={m.user?.avatar} />
                              <span className="font-medium">{m.user?.fullName}</span>
                            </span>
                          ))}
                          {assigneeMembers.length > 4 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#4A5565]">+{assigneeMembers.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    {reviewerMembers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium text-[#6A7282] w-[56px] shrink-0">Review:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {reviewerMembers.slice(0, 4).map(m => (
                            <span key={m.userId} className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] pl-0.5 pr-2.5 py-0.5 text-[11px] text-[#166534]">
                              <Avatar name={m.user?.fullName} color="#22C55E" avatarSrc={m.user?.avatar} />
                              <span className="font-medium">{m.user?.fullName}</span>
                            </span>
                          ))}
                          {reviewerMembers.length > 4 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#4A5565]">+{reviewerMembers.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-[11px] text-[#6A7282] mt-2">
                    {cr.attachments?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                        </svg>
                        {cr.attachments?.length} file{cr.attachments?.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span>{fmtRel(cr.createdAt)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {/* View Details */}
                  <button
                    onClick={() => setDetailCR(cr)}
                    title="View Details"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    View
                  </button>
                  {/* Edit */}
                  {canEdit && (
                  <button
                    onClick={() => setEditCR(cr)}
                    title="Edit"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-[8px] border border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#FFFBEB] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                    </svg>
                  </button>
                  )}
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteCR(cr)}
                    title="Delete"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-[8px] border border-[#E5E7EB] bg-white text-[#364153] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] hover:text-[#DC2626] transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
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
          projectPublicId={projectPublicId}
          currentUserId={currentUserId}
          currentRole={currentRole}
          workflowStages={workflowStages}
          onClose={() => setDetailCR(null)}
          onStatusChange={handleStatusChange}
          onTaskLinked={(taskId) => setDetailCR(prev => prev ? { ...prev, linkedTaskIds: [...prev.linkedTaskIds, taskId] } : prev)}
          onTaskUnlinked={(taskId) => setDetailCR(prev => prev ? { ...prev, linkedTaskIds: prev.linkedTaskIds.filter(id => id !== taskId) } : prev)}
          onRefreshCR={(fresh) => setDetailCR(fresh)}
        />
      )}
      {editCR && (
        <EditModal
          cr={editCR}
          disciplines={disciplines}
          modelFiles={modelFiles}
          teamMembers={teamMembers}
          loadingFiles={loadingFiles}
          onClose={() => setEditCR(null)}
          onUpdated={handleUpdated}
        />
      )}
      {deleteCR && (
        <DeleteConfirmModal
          cr={deleteCR}
          onClose={() => setDeleteCR(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
