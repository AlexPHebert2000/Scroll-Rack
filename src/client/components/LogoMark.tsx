import React from 'react';

interface Props { size?: number; }

const LogoMark = ({ size = 28 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="44" height="44" rx="8" fill="#2C333D" />
    <line x1="22" y1="9" x2="22" y2="35" stroke="#6ABFA8" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="22" cy="13" r="3" fill="#AA7946" />
    <circle cx="22" cy="22" r="3" fill="#6ABFA8" />
    <circle cx="22" cy="31" r="3" fill="#6ABFA8" />
    <path d="M22 22 Q31 22 31 15" stroke="#AA7946" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <circle cx="31" cy="15" r="2.5" fill="#AA7946" />
  </svg>
);

export default LogoMark;
