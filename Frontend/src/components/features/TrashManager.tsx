import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/skeletons';

interface TrashItem {
  id: string;
  name: string;
  type: 'folder' | 'project';
  thumbnail: string;
  deletedAt: string;
  deletedBy: string;
  parentFolder: string | null;
  daysUntilPermanentDeletion: number;
}

interface TrashManagerProps {
  initialItems: TrashItem[];
}

// Icons
const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const RestoreIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MoreIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const TrashEmptyIcon = () => (
  <svg className="h-16 w-16 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 14) return '1 week ago';
  return `${Math.floor(diffInDays / 7)} weeks ago`;
}

// Confirmation Dialog Component
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = 'danger'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'danger' | 'primary';
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
              confirmVariant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Notification Component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info'; onClose: () => void }) {
  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all',
      type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'
    )}>
      {type === 'success' && (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <DeleteIcon />
      </button>
    </div>
  );
}

export function TrashManager({ initialItems }: TrashManagerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [items, setItems] = useState<TrashItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary';
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.deletedBy.toLowerCase().includes(query) ||
        item.parentFolder?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Toggle item selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // Select all items
  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  // Restore single item
  const restoreItem = (id: string) => {
    const item = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    showToast(`"${item?.name}" has been restored`);
  };

  // Restore selected items
  const restoreSelected = () => {
    const count = selectedItems.size;
    setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
    setSelectedItems(new Set());
    showToast(`${count} item${count > 1 ? 's' : ''} restored`);
  };

  // Permanently delete single item
  const deleteItemPermanently = (id: string) => {
    const item = items.find(i => i.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete permanently?',
      message: `"${item?.name}" will be permanently deleted. This action cannot be undone.`,
      confirmText: 'Delete permanently',
      variant: 'danger',
      onConfirm: () => {
        setItems(prev => prev.filter(i => i.id !== id));
        setSelectedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        showToast(`"${item?.name}" permanently deleted`);
      }
    });
  };

  // Delete selected items permanently
  const deleteSelectedPermanently = () => {
    const count = selectedItems.size;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} item${count > 1 ? 's' : ''} permanently?`,
      message: `These items will be permanently deleted. This action cannot be undone.`,
      confirmText: 'Delete permanently',
      variant: 'danger',
      onConfirm: () => {
        setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
        setSelectedItems(new Set());
        showToast(`${count} item${count > 1 ? 's' : ''} permanently deleted`);
      }
    });
  };

  // Empty trash
  const emptyTrash = () => {
    if (items.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Empty trash?',
      message: `All ${items.length} items in trash will be permanently deleted. This action cannot be undone.`,
      confirmText: 'Empty trash',
      variant: 'danger',
      onConfirm: () => {
        setItems([]);
        setSelectedItems(new Set());
        showToast('Trash emptied');
      }
    });
  };

  useEffect(() => { setIsHydrated(true); }, []);

  if (!isHydrated) return <TableSkeleton rows={8} cols={5} />;

  return (
    <div className="space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={emptyTrash}
          disabled={items.length === 0}
          className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          Empty Trash
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search deleted items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Bulk actions when items selected */}
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} selected
            </span>
            <button
              onClick={restoreSelected}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <RestoreIcon />
              Restore
            </button>
            <button
              onClick={deleteSelectedPermanently}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              <DeleteIcon />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Items list */}
      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={selectAll}
              className={cn(
                'h-5 w-5 rounded border-2 transition-colors flex items-center justify-center',
                selectedItems.size === filteredItems.length && filteredItems.length > 0
                  ? 'border-indigo-600 bg-indigo-600'
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              {selectedItems.size === filteredItems.length && filteredItems.length > 0 && (
                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className="text-sm text-muted-foreground">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} in trash
            </span>
          </div>

          {/* Item rows */}
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-all',
                selectedItems.has(item.id)
                  ? 'border-indigo-200 bg-indigo-50/50'
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelection(item.id)}
                className={cn(
                  'h-5 w-5 shrink-0 rounded border-2 transition-colors flex items-center justify-center',
                  selectedItems.has(item.id)
                    ? 'border-indigo-600 bg-indigo-600'
                    : 'border-gray-300 hover:border-gray-400'
                )}
              >
                {selectedItems.has(item.id) && (
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Thumbnail */}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                <img
                  src={item.thumbnail}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground truncate">{item.name}</h3>
                  <span className={cn(
                    'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
                    item.type === 'folder'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-50 text-blue-600'
                  )}>
                    {item.type === 'folder' ? 'Folder' : 'Project'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon />
                    Deleted {formatTimeAgo(item.deletedAt)}
                  </span>
                  <span>by {item.deletedBy}</span>
                  {item.parentFolder && (
                    <span className="flex items-center gap-1.5">
                      <FolderIcon />
                      {item.parentFolder}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => restoreItem(item.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
                  title="Restore"
                >
                  <RestoreIcon />
                </button>
                <button
                  onClick={() => deleteItemPermanently(item.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete permanently"
                >
                  <DeleteIcon />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
                  >
                    <MoreIcon />
                  </button>
                  {dropdownOpen === item.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setDropdownOpen(null)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => {
                            restoreItem(item.id);
                            setDropdownOpen(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-gray-50"
                        >
                          <RestoreIcon />
                          Restore item
                        </button>
                        <button
                          onClick={() => {
                            deleteItemPermanently(item.id);
                            setDropdownOpen(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                        >
                          <DeleteIcon />
                          Delete permanently
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty state - no items in trash */
        <div className="flex flex-col items-center justify-center py-20">
          <TrashEmptyIcon />
          <h3 className="mt-4 text-lg font-medium text-foreground">Trash is empty</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Items you delete will appear here for 30 days before being permanently removed.
          </p>
        </div>
      ) : (
        /* No search results */
        <div className="flex flex-col items-center justify-center py-20">
          <SearchIcon />
          <h3 className="mt-4 text-lg font-medium text-foreground">No items found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search query
          </p>
        </div>
      )}

      {/* Auto-deletion warning */}
      {items.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-amber-600">
              <AlertIcon />
            </div>
            <div>
              <h4 className="font-medium text-amber-800">Auto-deletion in 30 days</h4>
              <p className="mt-1 text-sm text-amber-700">
                Items in trash will be permanently deleted after 30 days. Restore them before they're gone forever.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          confirmVariant={confirmDialog.variant}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default TrashManager;
