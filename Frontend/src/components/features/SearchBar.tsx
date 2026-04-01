import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ 
  placeholder = 'Search projects, files, tasks, or people ...', 
  className 
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all',
          isFocused 
            ? 'border-primary ring-2 ring-primary/20' 
            : 'border-input hover:border-primary/50'
        )}
      >
        <svg 
          className="h-5 w-5 shrink-0 text-muted-foreground" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
