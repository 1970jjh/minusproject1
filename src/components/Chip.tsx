interface ChipProps {
  count?: number;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({ count, className = '' }) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 border border-yellow-200 shadow-sm flex items-center justify-center">
        <div className="w-4 h-4 rounded-full border border-yellow-500/50 bg-yellow-400/20"></div>
      </div>
      {count !== undefined && (
        <span className="font-mono font-bold text-yellow-400 text-sm">x{count}</span>
      )}
    </div>
  );
};
