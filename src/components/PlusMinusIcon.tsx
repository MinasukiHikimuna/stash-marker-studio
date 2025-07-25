"use client";

interface PlusMinusIconProps {
  type: 'plus' | 'minus';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export default function PlusMinusIcon({ type, onClick, className = "" }: PlusMinusIconProps) {
  const baseClasses = "inline-block cursor-pointer transition-colors duration-200";
  const sizeClasses = "w-4 h-4";
  
  const plusColor = "#0f9960";
  const minusColor = "#db3737";

  if (type === 'plus') {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        className={`${baseClasses} ${sizeClasses} ${className}`}
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        onClick={onClick}
      >
        <path
          fill={plusColor}
          d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM232 344V280H168c-13.3 0-24-10.7-24-24s10.7-24 24-24h64V168c0-13.3 10.7-24 24-24s24 10.7 24 24v64h64c13.3 0 24 10.7 24 24s-10.7 24-24 24H280v64c0 13.3-10.7 24-24 24s-24-10.7-24-24z"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`${baseClasses} ${sizeClasses} ${className}`}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      onClick={onClick}
    >
      <path
        fill={minusColor}
        d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM184 232H328c13.3 0 24 10.7 24 24s-10.7 24-24 24H184c-13.3 0-24-10.7-24-24s10.7-24 24-24z"
      />
    </svg>
  );
}