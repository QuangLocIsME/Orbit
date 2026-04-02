'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type ClearanceRule = {
  id: string;
  typeA: string;
  typeB: string;
  minClearance: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

export type DetectionSettings = {
  clearanceThreshold: number;
  rules: ClearanceRule[];
};

export const DEFAULT_SETTINGS: DetectionSettings = {
  clearanceThreshold: 0,
  rules: [],
};

const SETTINGS_STORAGE_KEY = 'orbit_clash_detection_settings';

export const loadSettings = (): DetectionSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as DetectionSettings;
    return {
      clearanceThreshold: typeof parsed.clearanceThreshold === 'number' ? parsed.clearanceThreshold : 0,
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: DetectionSettings) => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

// ---------------------------------------------------------------------------
// IFC types available in mock data (và sẽ có trong IFC model thật)
// ---------------------------------------------------------------------------
const IFC_TYPES = [
  'IfcWall',
  'IfcBeam',
  'IfcColumn',
  'IfcSlab',
  'IfcPipeSegment',
  'IfcDuctSegment',
  'IfcCableCarrierSegment',
  'IfcStair',
  'IfcRoof',
  'IfcDoor',
  'IfcWindow',
];

const SEVERITIES: ClearanceRule['severity'][] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_COLORS: Record<ClearanceRule['severity'], string> = {
  critical: 'text-[#7C1D1D] bg-[#FEE2E2]',
  high:     'text-[#C70036] bg-[#FFF1F2]',
  medium:   'text-[#B45309] bg-[#FEF3C7]',
  low:      'text-[#166534] bg-[#D1FAE5]',
};

// ---------------------------------------------------------------------------
// Preset rules for common BIM coordination scenarios
// ---------------------------------------------------------------------------
const PRESET_RULES: Omit<ClearanceRule, 'id'>[] = [
  { typeA: 'IfcPipeSegment', typeB: 'IfcBeam',   minClearance: 0.05, severity: 'high' },
  { typeA: 'IfcPipeSegment', typeB: 'IfcColumn', minClearance: 0.05, severity: 'high' },
  { typeA: 'IfcDuctSegment', typeB: 'IfcBeam',   minClearance: 0.10, severity: 'high' },
  { typeA: 'IfcDuctSegment', typeB: 'IfcSlab',   minClearance: 0.15, severity: 'medium' },
  { typeA: 'IfcCableCarrierSegment', typeB: 'IfcPipeSegment', minClearance: 0.05, severity: 'medium' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const genId = () => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface DetectionSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** Called khi user nhấn "Apply & Run Detection" */
  onApply: (settings: DetectionSettings) => void;
  initialSettings?: DetectionSettings;
}

export default function DetectionSettingsModal({
  open,
  onClose,
  onApply,
  initialSettings,
}: DetectionSettingsModalProps) {
  const [threshold, setThreshold] = useState(0);
  const [rules, setRules] = useState<ClearanceRule[]>([]);
  const [editingRule, setEditingRule] = useState<ClearanceRule | null>(null);

  useEffect(() => {
    if (!open) return;
    const settings = initialSettings ?? loadSettings();
    setThreshold(settings.clearanceThreshold);
    setRules(settings.rules);
    setEditingRule(null);
  }, [open, initialSettings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleAddPresets = () => {
    const newRules: ClearanceRule[] = PRESET_RULES
      .filter((p) => !rules.some((r) => r.typeA === p.typeA && r.typeB === p.typeB))
      .map((p) => ({ ...p, id: genId() }));
    setRules((prev) => [...prev, ...newRules]);
  };

  const handleAddRule = () => {
    setEditingRule({
      id: genId(),
      typeA: 'IfcPipeSegment',
      typeB: 'IfcBeam',
      minClearance: 0.05,
      severity: 'high',
    });
  };

  const handleSaveRule = (rule: ClearanceRule) => {
    setRules((prev) => {
      const exists = prev.findIndex((r) => r.id === rule.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = rule;
        return next;
      }
      return [...prev, rule];
    });
    setEditingRule(null);
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingRule?.id === id) setEditingRule(null);
  };

  const handleApply = () => {
    const settings: DetectionSettings = { clearanceThreshold: threshold, rules };
    saveSettings(settings);
    onApply(settings);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detection-settings-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <h2 id="detection-settings-title" className="text-lg font-semibold text-[#101828]">
              Detection Settings
            </h2>
            <p className="mt-0.5 text-sm text-[#6A7282]">
              Cấu hình clearance threshold và per-type rules trước khi chạy detection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D1D5DC] px-3 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">

          {/* --- Global clearance threshold --- */}
          <section>
            <h3 className="text-sm font-semibold text-[#101828]">Global Clearance Threshold</h3>
            <p className="mt-1 text-xs text-[#6A7282]">
              Khoảng cách tối thiểu (meters) giữa 2 bất kỳ object nào. Objects trong khoảng cách này
              sẽ bị detect là <strong>soft clash</strong>. Đặt 0 để chỉ detect hard clash (giao nhau thực sự).
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="h-2 w-48 accent-[#155DFC]"
              />
              <input
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 rounded-lg border border-[#D1D5DC] px-3 py-1.5 text-sm text-[#101828] outline-none transition-colors focus:border-[#155DFC]"
              />
              <span className="text-sm text-[#6A7282]">m</span>
              {threshold === 0 && (
                <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6A7282]">Hard clash only</span>
              )}
              {threshold > 0 && (
                <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs text-[#1D4ED8]">
                  Soft clash ≤ {threshold.toFixed(2)} m
                </span>
              )}
            </div>
          </section>

          {/* --- Per-type rules --- */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#101828]">Per-Type Clearance Rules</h3>
                <p className="mt-1 text-xs text-[#6A7282]">
                  Rules này override global threshold cho từng cặp loại cấu kiện cụ thể.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddPresets}
                  className="rounded-lg border border-[#D1D5DC] bg-white px-3 py-1.5 text-xs text-[#364153] transition-colors hover:bg-gray-50"
                  title="Thêm preset rules phổ biến cho MEP coordination"
                >
                  + Load Presets
                </button>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="rounded-lg bg-[#155DFC] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  + Add Rule
                </button>
              </div>
            </div>

            {/* Rules table */}
            {rules.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-[#D1D5DC] bg-[#F9FAFB] py-8 text-center text-sm text-[#6A7282]">
                Chưa có rule nào. Click "+ Load Presets" để thêm nhanh, hoặc "+ Add Rule" để tự thêm.
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6A7282]">Type A</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6A7282]">Type B</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6A7282]">Min Clearance</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6A7282]">Severity</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule, idx) => (
                      <tr
                        key={rule.id}
                        className={cn(
                          'border-b border-[#E5E7EB] last:border-0',
                          editingRule?.id === rule.id ? 'bg-[#EFF6FF]' : idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                        )}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-[#101828]">{rule.typeA}</td>
                        <td className="px-4 py-2 font-mono text-xs text-[#101828]">{rule.typeB}</td>
                        <td className="px-4 py-2 text-xs text-[#101828]">{rule.minClearance.toFixed(2)} m</td>
                        <td className="px-4 py-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_COLORS[rule.severity])}>
                            {rule.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingRule({ ...rule })}
                              className="rounded px-2 py-1 text-xs text-[#6A7282] transition-colors hover:bg-[#F3F4F6]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="rounded px-2 py-1 text-xs text-[#EF4444] transition-colors hover:bg-[#FEF2F2]"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inline rule editor */}
            {editingRule && (
              <RuleEditor
                rule={editingRule}
                ifcTypes={IFC_TYPES}
                severities={SEVERITIES}
                severityColors={SEVERITY_COLORS}
                onChange={setEditingRule}
                onSave={handleSaveRule}
                onCancel={() => setEditingRule(null)}
              />
            )}
          </section>

          {/* Preset info */}
          <section className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs text-[#6A7282]">
            <p className="font-medium text-[#364153]">Về Clearance Rules</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Rules override global threshold cho cặp type cụ thể.</li>
              <li>Nếu 2 objects match 1 rule → dùng <code>minClearance</code> của rule thay vì global.</li>
              <li>Presets dựa trên tiêu chuẩn MEP coordination (ISO 16739, Revit best practices).</li>
              <li>Settings được lưu trong localStorage, áp dụng cho tất cả projects.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={() => { setThreshold(0); setRules([]); }}
            className="text-sm text-[#6A7282] underline-offset-2 transition-colors hover:text-[#101828]"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { saveSettings({ clearanceThreshold: threshold, rules }); onClose(); }}
              className="rounded-lg border border-[#D1D5DC] bg-white px-4 py-2 text-sm text-[#364153] transition-colors hover:bg-gray-50"
            >
              Save only
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-[#155DFC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Apply &amp; Run Detection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Rule Editor
// ---------------------------------------------------------------------------
interface RuleEditorProps {
  rule: ClearanceRule;
  ifcTypes: string[];
  severities: ClearanceRule['severity'][];
  severityColors: Record<ClearanceRule['severity'], string>;
  onChange: (rule: ClearanceRule) => void;
  onSave: (rule: ClearanceRule) => void;
  onCancel: () => void;
}

function RuleEditor({ rule, ifcTypes, severities, severityColors, onChange, onSave, onCancel }: RuleEditorProps) {
  const isValid = rule.typeA && rule.typeB && rule.typeA !== rule.typeB && rule.minClearance >= 0;

  return (
    <div className="mt-3 rounded-xl border border-[#155DFC]/30 bg-[#EFF6FF] p-4 space-y-3">
      <p className="text-xs font-semibold text-[#1D4ED8]">
        {rule.id.startsWith('rule-') ? 'Edit Rule' : 'New Rule'}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6A7282]">Type A</span>
          <select
            value={rule.typeA}
            onChange={(e) => onChange({ ...rule, typeA: e.target.value })}
            className="rounded-lg border border-[#D1D5DC] bg-white px-2 py-1.5 text-xs text-[#101828] outline-none focus:border-[#155DFC]"
          >
            {ifcTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6A7282]">Type B</span>
          <select
            value={rule.typeB}
            onChange={(e) => onChange({ ...rule, typeB: e.target.value })}
            className="rounded-lg border border-[#D1D5DC] bg-white px-2 py-1.5 text-xs text-[#101828] outline-none focus:border-[#155DFC]"
          >
            {ifcTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6A7282]">Min Clearance (m)</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={rule.minClearance}
            onChange={(e) => onChange({ ...rule, minClearance: Math.max(0, parseFloat(e.target.value) || 0) })}
            className="rounded-lg border border-[#D1D5DC] bg-white px-2 py-1.5 text-xs text-[#101828] outline-none focus:border-[#155DFC]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#6A7282]">Override Severity</span>
          <select
            value={rule.severity}
            onChange={(e) => onChange({ ...rule, severity: e.target.value as ClearanceRule['severity'] })}
            className="rounded-lg border border-[#D1D5DC] bg-white px-2 py-1.5 text-xs text-[#101828] outline-none focus:border-[#155DFC]"
          >
            {severities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {rule.typeA === rule.typeB && (
        <p className="text-xs text-[#EF4444]">Type A và Type B phải khác nhau.</p>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg border border-[#D1D5DC] bg-white px-3 py-1.5 text-xs text-[#364153] hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => isValid && onSave(rule)}
          className={cn('rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors', isValid ? 'bg-[#155DFC] hover:bg-blue-700' : 'cursor-not-allowed bg-blue-300')}
        >
          Save Rule
        </button>
      </div>
    </div>
  );
}
