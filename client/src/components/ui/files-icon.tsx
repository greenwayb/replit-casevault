interface FilesIconProps {
  className?: string;
}

export function FilesIcon({ className = "h-6 w-6" }: FilesIconProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {/* Main document */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      
      {/* Second document behind, offset */}
      <path d="M12 0H4a2 2 0 0 0-2 2v14" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <polyline points="12,0 12,6 18,6" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      
      {/* Third document behind, more offset */}
      <path d="M10 -2H2a2 2 0 0 0-2 2v12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <polyline points="10,-2 10,4 16,4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      
      {/* Document lines */}
      <line x1="9" y1="15" x2="15" y2="15" strokeWidth="1.5" />
      <line x1="9" y1="18" x2="13" y2="18" strokeWidth="1.5" />
    </svg>
  );
}