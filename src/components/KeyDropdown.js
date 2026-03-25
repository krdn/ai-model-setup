'use client';

import { useState, useEffect, useRef } from 'react';

export default function KeyDropdown({ keys, activeKey, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div 
        className="dropdown-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {activeKey ? `${activeKey.provider} - ${activeKey.name}` : 'Select API Key'}
        </span>
        <span style={{ marginLeft: '10px', fontSize: '0.8em' }}>▼</span>
      </div>
      
      {isOpen && (
        <div className="dropdown-list">
          {keys.length === 0 ? (
            <div className="dropdown-item" style={{ color: 'var(--text-secondary)' }}>
              No keys available
            </div>
          ) : (
            keys.map(k => (
              <div 
                key={k.id}
                className={`dropdown-item ${activeKey?.id === k.id ? 'active' : ''}`}
                onClick={() => {
                  onSelect(k);
                  setIsOpen(false);
                }}
              >
                <div><strong>{k.provider}</strong></div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {k.name} ({k.maskedKey})
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
