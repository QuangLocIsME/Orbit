const fs = require('fs');
const path = 'c:/Users/ADMIN/Desktop/SSOrbit/Orbit/Frontend/src/components/features/ChangesTab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add Version interface at the top (after LinkedTask interface, line ~80)
// First find where LinkedTask interface ends
let insertAfter = -1;
for (let i = 75; i < 100; i++) {
  if (lines[i] && lines[i].includes('}')) {
    insertAfter = i;
    break;
  }
}

const versionInterface = [
  '',
  'interface Version {',
  '  publicId: string;',
  '  versionNumber: number;',
  '  versionLabel: string;',
  '  referenceType: \'document\' | \'cr\' | \'cde\' | \'manual\';',
  '  referenceId: string | null;',
  '  projectId: string;',
  '  cdeState: \'WIP\' | \'Shared\' | \'Published\' | \'Archived\';',
  '  previousCdeState: string | null;',
  '  snapshot: {',
  '    title: string;',
  '    description: string;',
  '    disciplineId: string | null;',
  '    fileMeta?: { originalName: string; mimeType: string; size: number; s3Url: string; geometryHash: string; };',
  '    crData?: { title: string; description: string; status: string; priority: string; estimatedImpact: string | null; affectedModels: string[]; structuredSections: StructuredSections | null; linkedTaskIds: string[]; };',
  '  };',
  '  resultFiles: ResultAttachment[];',
  '  approval: { status: \'none\' | \'pending\' | \'approved\' | \'rejected\'; approverId: string | null; approvedAt: string | null; rejectionReason: string; };',
  '  changeLog: { action: string; userId: string; timestamp: string; detail: string; metadata: Record<string, unknown>; }[];',
  '  tags: string[];',
  '  isRollback: boolean;',
  '  rolledBackFrom: string | null;',
  '  createdBy: string;',
  '  createdAt: string;',
  '}',
  '',
];

lines.splice(insertAfter + 1, 0, ...versionInterface);
let offset = versionInterface.length;

// 2. Add CDE_STATE_CFG and APPROVAL_STATUS_CFG after STATUS_CFG
let cfgInsert = -1;
for (let i = 145; i < 175; i++) {
  if (lines[i] && lines[i].includes('as const;') && lines[i].includes('MODEL_EXT')) {
    cfgInsert = i + 1;
    break;
  }
}

const configs = [
  '',
  'const CDE_STATE_CFG = {',
  '  WIP:       { label: \'WIP\',       bg: \'bg-[#FEF3C7]\', text: \'text-[#92400E]\' },',
  '  Shared:    { label: \'Shared\',    bg: \'bg-[#DBEAFE]\', text: \'text-[#1E40AF]\' },',
  '  Published: { label: \'Published\', bg: \'bg-[#D1FAE5]\', text: \'text-[#065F46]\' },',
  '  Archived:  { label: \'Archived\',  bg: \'bg-[#F3F4F6]\', text: \'text-[#374151]\' },',
  '} as const;',
  '',
  'const APPROVAL_STATUS_CFG = {',
  '  none:     { label: \'No Approval\', bg: \'bg-[#F3F4F6]\', text: \'text-[#6B7280]\' },',
  '  pending:  { label: \'Pending\',      bg: \'bg-[#FEF3C7]\', text: \'text-[#B45309]\' },',
  '  approved: { label: \'Approved\',     bg: \'bg-[#D1FAE5]\', text: \'text-[#065F46]\' },',
  '  rejected: { label: \'Rejected\',    bg: \'bg-[#FEE2E2]\', text: \'text-[#991B1B]\' },',
  '} as const;',
  '',
];

lines.splice(cfgInsert + offset, 0, ...configs);
offset += configs.length;

// 3. Add version state after task loading useEffect
let stateInsert = -1;
for (let i = 960; i < 980; i++) {
  if (lines[i] && lines[i].includes('[cr.linkedTaskIds, projectPublicId]')) {
    stateInsert = i + 1;
    break;
  }
}

const stateVars = [
  '',
  '  // ── Version history state ─────────────────────────────────────────────────────',
  '  const [versions, setVersions] = useState<Version[]>([]);',
  '  const [loadingVersions, setLoadingVersions] = useState(false);',
  '  const [showCreateVersion, setShowCreateVersion] = useState(false);',
  '  const [versionLabel, setVersionLabel] = useState(\'\');',
  '  const [versionTags, setVersionTags] = useState(\'\');',
  '  const [creatingVersion, setCreatingVersion] = useState(false);',
];

lines.splice(stateInsert + offset, 0, ...stateVars);
offset += stateVars.length;

// 4. Add version useEffect after state
const versionUseEffect = [
  '',
  '  // ── Load version history ─────────────────────────────────────────────────────',
  '  useEffect(() => {',
  '    let cancelled = false;',
  '    (async () => {',
  '      setLoadingVersions(true);',
  '      try {',
  '        const res = await apiFetch(`/api/change-requests/${cr.publicId}/versions`);',
  '        if (res.ok && !cancelled) {',
  '          const d = await res.json();',
  '          setVersions(Array.isArray(d?.data) ? d.data : []);',
  '        }',
  '      } catch { /* silent */ }',
  '      finally { if (!cancelled) setLoadingVersions(false); }',
  '    })();',
  '    return () => { cancelled = true; };',
  '  }, [cr.publicId]);',
];

let ueInsert = stateInsert + stateVars.length;
lines.splice(ueInsert + offset, 0, ...versionUseEffect);
offset += versionUseEffect.length;

// 5. Add version handler after handleLinkTask
let handlerInsert = -1;
for (let i = 1080; i < 1120; i++) {
  if (lines[i] && lines[i].includes('// ── Task linking handlers')) {
    handlerInsert = i + 1;
    break;
  }
}

const versionHandler = [
  '',
  '  // ── Version handlers ─────────────────────────────────────────────────────────',
  '  const handleCreateVersion = async () => {',
  '    setCreatingVersion(true);',
  '    try {',
  '      const tags = versionTags ? versionTags.split(\',\').map((t: string) => t.trim()).filter(Boolean) : [];',
  '      const res = await apiFetch(`/api/change-requests/${cr.publicId}/versions`, {',
  '        method: \'POST\',',
  '        headers: { \'Content-Type\': \'application/json\' },',
  '        body: JSON.stringify({',
  '          projectId: projectPublicId,',
  '          versionLabel: versionLabel.trim() || `${cr.crId} v1`,',
  '          cdeState: \'WIP\',',
  '          tags,',
  '          snapshotTitle: cr.title,',
  '          snapshotDescription: cr.description,',
  '        }),',
  '      });',
  '      const data = await res.json();',
  '      if (data.success) {',
  '        toast.success(\'Version snapshot created\');',
  '        setVersions(prev => [data.data, ...prev]);',
  '        setShowCreateVersion(false);',
  '        setVersionLabel(\'\');',
  '        setVersionTags(\'\');',
  '      } else {',
  '        toast.error(data.message || \'Failed to create version\');',
  '      }',
  '    } catch { toast.error(\'Failed to create version\'); }',
  '    finally { setCreatingVersion(false); }',
  '  };',
];

lines.splice(handlerInsert + offset, 0, ...versionHandler);
offset += versionHandler.length;

// 6. Add version form UI before Status actions comment
let uiInsert = -1;
for (let i = 1500; i < 1550; i++) {
  if (lines[i] && lines[i].includes('Version management is now available')) {
    uiInsert = i;
    break;
  }
}

const versionUI = [
  '          {/* ── Version History ─────────────────────────────────────────────── */}',
  '          {(cr.status === \'approved\' || cr.status === \'completed\') && (',
  '            <div className="border-t border-[#E5E7EB] pt-4">',
  '              <div className="flex items-center justify-between mb-3">',
  '                <div className="flex items-center gap-2">',
  '                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>',
  '                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  '                  </svg>',
  '                  <span className="text-sm font-semibold text-foreground">Version Snapshots</span>',
  '                  {versions.length > 0 && (',
  '                    <span className="ml-1 inline-flex h-5 items-center rounded-full bg-[#ECFDF5] px-2 text-[10px] font-medium text-[#007A55]">{versions.length}</span>',
  '                  )}',
  '                </div>',
  '                <button',
  '                  onClick={() => setShowCreateVersion(true)}',
  '                  className="rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#364153] hover:bg-[#F9FAFB] transition-colors"',
  '                >',
  '                  + Create Version',
  '                </button>',
  '              </div>',
  '',
  '              {loadingVersions ? (',
  '                <div className="flex items-center justify-center py-4">',
  '                  <svg className="h-4 w-4 animate-spin text-[#155DFC]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>',
  '                </div>',
  '              ) : versions.length === 0 ? (',
  '                <p className="text-[13px] text-muted-foreground/60 text-center py-4">No versions yet. Create a version to track snapshots.</p>',
  '              ) : (',
  '                <div className="space-y-2">',
  '                  {versions.slice(0, 5).map(v => {',
  '                    const cde = CDE_STATE_CFG[v.cdeState] || CDE_STATE_CFG[\'WIP\'];',
  '                    const ap = APPROVAL_STATUS_CFG[v.approval?.status] || APPROVAL_STATUS_CFG[\'none\'];',
  '                    return (',
  '                      <details key={v.publicId} className="rounded-[8px] border border-[#E5E7EB]">',
  '                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F9FAFB] list-none">',
  '                          <div className="flex items-center gap-3">',
  '                            <div className="h-8 w-8 rounded-[8px] bg-[#ECFDF5] flex items-center justify-center">',
  '                              <svg className="h-4 w-4 text-[#007A55]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>',
  '                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
  '                              </svg>',
  '                            </div>',
  '                            <div className="flex flex-col gap-1">',
  '                              <div className="flex items-center gap-2">',
  '                                <p className="text-[13px] font-medium text-[#101828]">{v.versionLabel || `v${v.versionNumber}`}</p>',
  '                                <span className={cn(\'rounded-full px-1.5 py-0.5 text-[10px] font-medium\', cde.bg, cde.text)}>{cde.label}</span>',
  '                                <span className={cn(\'rounded-full px-1.5 py-0.5 text-[10px] font-medium\', ap.bg, ap.text)}>{ap.label}</span>',
  '                              </div>',
  '                              <p className="text-[11px] text-[#6A7282]">',
  '                                {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString()}',
  '                                {v.tags && v.tags.length > 0 && <span className="ml-1">· {v.tags.join(\', \')}</span>}',
  '                              </p>',
  '                            </div>',
  '                          </div>',
  '                          <svg className="h-4 w-4 text-[#6A7282] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>',
  '                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>',
  '                          </svg>',
  '                        </summary>',
  '                        <div className="px-4 pb-4 border-t border-[#F3F4F6] pt-3 space-y-2">',
  '                          {v.snapshot?.title && <p className="text-[12px] font-medium text-[#364153]">{v.snapshot.title}</p>}',
  '                          {v.snapshot?.description && <p className="text-[12px] text-[#6A7282]">{v.snapshot.description}</p>}',
  '                          {v.approval?.status === \'rejected\' && v.approval.rejectionReason && (',
  '                            <div className="rounded-[6px] bg-[#FEE2E2] p-2">',
  '                              <p className="text-[11px] text-[#991B1B]">Rejection reason: {v.approval.rejectionReason}</p>',
  '                            </div>',
  '                          )}',
  '                          {v.changeLog && v.changeLog.length > 0 && (',
  '                            <div className="pt-1">',
  '                              <p className="text-[11px] font-semibold text-[#6A7282] mb-1">Change Log:</p>',
  '                              {v.changeLog.map((entry, i) => (',
  '                                <div key={i} className="text-[11px] text-[#6A7282]">',
  '                                  <span className="font-medium text-[#4B5563]">[{entry.action}]</span> {entry.detail} — {new Date(entry.timestamp).toLocaleString()}',
  '                                </div>',
  '                              ))}',
  '                            </div>',
  '                          )}',
  '                        </div>',
  '                      </details>',
  '                    );',
  '                  })}',
  '                  {versions.length > 5 && (',
  '                    <p className="text-[12px] text-center text-[#6A7282]">+ {versions.length - 5} more versions — view all in Versions tab</p>',
  '                  )}',
  '                </div>',
  '              )}',
  '            </div>',
  '          )}',
  '',
  '          {/* ── Create Version form ─────────────────────────────────────────── */}',
  '          {showCreateVersion && (',
  '            <div className="rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 space-y-3">',
  '              <p className="text-[13px] font-semibold text-[#1D4ED8]">Create Version Snapshot</p>',
  '              <input type="text" placeholder="Version label (e.g. CR-001 Final)" value={versionLabel}',
  '                onChange={e => setVersionLabel(e.target.value)}',
  '                className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none" />',
  '              <input type="text" placeholder="Tags (comma-separated, e.g. milestone, approved)" value={versionTags}',
  '                onChange={e => setVersionTags(e.target.value)}',
  '                className="w-full h-[36px] rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] focus:border-[#155DFC] focus:outline-none" />',
  '              <div className="flex justify-end gap-2">',
  '                <button onClick={() => { setShowCreateVersion(false); setVersionLabel(\'\'); setVersionTags(\'\'); }} className="px-3 py-1.5 text-[12px] text-[#364153]">Cancel</button>',
  '                <button onClick={handleCreateVersion} disabled={creatingVersion}',
  '                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#007A55] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-green-700 disabled:opacity-60">',
  '                  {creatingVersion ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : \'\'}',
  '                  {creatingVersion ? \'Creating…\' : \'Create Version\'}',
  '                </button>',
  '              </div>',
  '            </div>',
  '          )}',
];

lines.splice(uiInsert + offset, 0, ...versionUI);
offset += versionUI.length;

// 7. Remove the placeholder comment
let commentIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] && lines[i].includes('Version management is now available')) {
    commentIdx = i;
    break;
  }
}
if (commentIdx !== -1) {
  lines.splice(commentIdx, 1);
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Done. New total lines: ' + lines.length);
