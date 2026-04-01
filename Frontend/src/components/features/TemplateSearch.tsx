import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TemplateSearchProps {
  allTags: string[];
  onSearch: (query: string, selectedTags: string[]) => void;
}

export function TemplateSearch({ allTags, onSearch }: TemplateSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>(allTags);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter tags based on query and exclude already selected
  useEffect(() => {
    const available = allTags.filter(tag => 
      !selectedTags.includes(tag) &&
      tag.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredTags(available);
  }, [query, selectedTags, allTags]);

  // Notify parent of changes
  useEffect(() => {
    onSearch(query, selectedTags);
  }, [query, selectedTags, onSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag: string) => {
    setSelectedTags(prev => [...prev, tag]);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  const handleClearAll = () => {
    setSelectedTags([]);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && query === '' && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    }
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
    if (e.key === 'Enter' && filteredTags.length > 0) {
      e.preventDefault();
      handleAddTag(filteredTags[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Container */}
      <div 
        className={cn(
          'flex min-h-[44px] items-center gap-2 rounded-xl border bg-background px-4 py-2 transition-all duration-150',
          isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
        )}
        onClick={() => {
          inputRef.current?.focus();
          setIsDropdownOpen(true);
        }}
      >
        {/* Search Icon */}
        <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Selected Tags */}
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-blue-700"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? "Search templates or filter by tags..." : "Search..."}
            className="min-w-[120px] flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Filter Icon - Fixed to right */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className={cn(
            'shrink-0 rounded-lg p-1.5 transition-colors',
            isDropdownOpen ? 'bg-blue-100 text-blue-600' : 'text-muted-foreground hover:bg-gray-100'
          )}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Select tags to filter:</span>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                clear all
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {filteredTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
              >
                {tag}
              </button>
            ))}
            {filteredTags.length === 0 && (
              <p className="text-sm text-muted-foreground">No matching tags found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateSearch;
