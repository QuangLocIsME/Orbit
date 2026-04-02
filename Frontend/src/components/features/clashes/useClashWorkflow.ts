'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '@/config/api';
import type { Clash, ClashGroup, ClashHistoryEntry } from '@/data/clashes';
import { createHistoryEntry } from '@/data/clashes';

interface ResolvePayload {
  note?: string;
  severity?: Clash['severity'];
}

const syncGroups = (groups: ClashGroup[], clashes: Clash[]) => {
  const clashesById = new Map(clashes.map((clash) => [clash.id, clash]));

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => clashesById.get(item.id))
        .filter((item): item is Clash => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({ ...group, count: group.items.length }));
};

export function useClashWorkflow(projectSlug: string) {
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [groups, setGroups] = useState<ClashGroup[]>([]);
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null);
  const [resolvePanelClashId, setResolvePanelClashId] = useState<string | null>(null);

  const selectedClash = useMemo(
    () => clashes.find((clash) => clash.id === selectedClashId) ?? null,
    [clashes, selectedClashId]
  );

  const resolvePanelClash = useMemo(
    () => clashes.find((clash) => clash.id === resolvePanelClashId) ?? null,
    [clashes, resolvePanelClashId]
  );

  const hydrate = useCallback((nextClashes: Clash[], nextGroups: ClashGroup[]) => {
    const mergedClashes = nextClashes;
    const mergedGroups = syncGroups(nextGroups, mergedClashes);

    setClashes(mergedClashes);
    setGroups(mergedGroups);
    setSelectedClashId((currentId) => {
      if (currentId && mergedClashes.some((clash) => clash.id === currentId)) {
        return currentId;
      }

      return mergedGroups[0]?.items[0]?.id ?? mergedClashes[0]?.id ?? null;
    });
  }, []);

  const updateClash = useCallback((
    clashId: string,
    updater: (clash: Clash) => Clash
  ) => {
    setClashes((currentClashes) => {
      const nextClashes = currentClashes.map((clash) =>
        clash.id === clashId ? updater(clash) : clash
      );

      setGroups((currentGroups) => syncGroups(currentGroups, nextClashes));

      return nextClashes;
    });
  }, []);

  const focusClash = useCallback((clashId: string) => {
    setSelectedClashId(clashId);

    updateClash(clashId, (clash) => ({
      ...clash,
      updatedAt: new Date().toISOString(),
      history: [
        ...(clash.history ?? []),
        createHistoryEntry('focused', `Focused clash ${clash.id} in the viewer.`),
      ],
    }));
  }, [updateClash]);

  const saveResolution = useCallback(async (clashId: string, nextState: Partial<Clash>) => {
    const existingClash = clashes.find((clash) => clash.id === clashId);
    if (!existingClash) {
      return;
    }

    const response = await fetch(
      apiUrl(`/projects/${encodeURIComponent(projectSlug)}/clashes/${encodeURIComponent(clashId)}`),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolved: nextState.resolved ?? existingClash.resolved,
          waived: nextState.waived ?? existingClash.waived ?? false,
          status: nextState.status ?? existingClash.status,
          note: typeof nextState.note === 'string' ? nextState.note : existingClash.note ?? '',
          severity: nextState.severity ?? existingClash.severity,
          assignedTo: nextState.assignedTo ?? existingClash.assignedTo ?? null,
          dueDate: nextState.dueDate ?? existingClash.dueDate ?? null,
          history: nextState.history ?? existingClash.history ?? [],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save clash resolution (${response.status})`);
    }
  }, [clashes, projectSlug]);

  const openResolvePanel = useCallback((clashId: string) => {
    setSelectedClashId(clashId);
    setResolvePanelClashId(clashId);
  }, []);

  const closeResolvePanel = useCallback(() => {
    setResolvePanelClashId(null);
  }, []);

  const updateClashNote = useCallback(async (clashId: string, note: string) => {
    const currentClash = clashes.find((clash) => clash.id === clashId);
    if (!currentClash) {
      return;
    }

    const nextClash = {
      ...currentClash,
      note,
      updatedAt: new Date().toISOString(),
      history: [
        ...(currentClash.history ?? []),
        createHistoryEntry('note-added', note ? 'Added or updated resolution note.' : 'Cleared note.'),
      ],
    };

    updateClash(clashId, () => nextClash);
    await saveResolution(clashId, nextClash);
  }, [clashes, saveResolution, updateClash]);

  const updateClashSeverity = useCallback(async (clashId: string, severity: Clash['severity']) => {
    const currentClash = clashes.find((clash) => clash.id === clashId);
    if (!currentClash) {
      return;
    }

    const nextClash = {
      ...currentClash,
      severity,
      updatedAt: new Date().toISOString(),
      history: [
        ...(currentClash.history ?? []),
        createHistoryEntry('severity-changed', `Severity changed to ${severity}.`),
      ],
    };

    updateClash(clashId, () => nextClash);
    await saveResolution(clashId, nextClash);
  }, [clashes, saveResolution, updateClash]);

  const markResolved = useCallback(async (clashId: string, payload: ResolvePayload = {}) => {
    const currentClash = clashes.find((clash) => clash.id === clashId);
    if (!currentClash) return;

    const nextClash = {
      ...currentClash,
      resolved: true,
      waived: false,
      status: 'resolved' as const,
      note: payload.note ?? currentClash.note,
      severity: payload.severity ?? currentClash.severity,
      updatedAt: new Date().toISOString(),
      history: [
        ...(currentClash.history ?? []),
        createHistoryEntry('resolved', 'Marked clash as resolved.'),
      ],
    };

    updateClash(clashId, () => nextClash);
    await saveResolution(clashId, nextClash);
    setResolvePanelClashId(null);
  }, [clashes, saveResolution, updateClash]);

  const markWaived = useCallback(async (clashId: string, payload: ResolvePayload = {}) => {
    const currentClash = clashes.find((clash) => clash.id === clashId);
    if (!currentClash) return;

    const nextClash = {
      ...currentClash,
      resolved: false,
      waived: true,
      status: 'waived' as const,
      note: payload.note ?? currentClash.note,
      updatedAt: new Date().toISOString(),
      history: [
        ...(currentClash.history ?? []),
        createHistoryEntry('resolved', 'Clash waived — no fix required.'),
      ],
    };

    updateClash(clashId, () => nextClash);
    await saveResolution(clashId, nextClash);
    setResolvePanelClashId(null);
  }, [clashes, saveResolution, updateClash]);

  const assignClash = useCallback(async (clashId: string, assignedTo: string, dueDate?: string) => {
    const currentClash = clashes.find((c) => c.id === clashId);
    if (!currentClash) return;

    const nextClash = {
      ...currentClash,
      assignedTo,
      dueDate: dueDate ?? currentClash.dueDate,
      status: currentClash.status === 'open' ? 'in-progress' as const : currentClash.status,
      updatedAt: new Date().toISOString(),
      history: [
        ...(currentClash.history ?? []),
        createHistoryEntry('resolved', `Assigned to ${assignedTo}.`),
      ],
    };

    updateClash(clashId, () => nextClash);
    await saveResolution(clashId, nextClash);
  }, [clashes, saveResolution, updateClash]);

  return {
    clashes,
    groups,
    selectedClash,
    resolvePanelClash,
    hydrate,
    focusClash,
    openResolvePanel,
    closeResolvePanel,
    setSelectedClashId,
    updateClashNote,
    updateClashSeverity,
    markResolved,
    markWaived,
    assignClash,
  };
}
