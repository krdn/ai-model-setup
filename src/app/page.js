'use client';

import { useState, useEffect } from 'react';
import ApiKeyManager from '@/components/ApiKeyManager';
import KeyDropdown from '@/components/KeyDropdown';
import ModelPlayground from '@/components/ModelPlayground';

export default function Home() {
  const [keys, setKeys] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/keys')
      .then(res => res.json())
      .then(data => {
        setKeys(data);
        if (data.length > 0) setActiveKey(data[0]);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleKeyAdded = (newKey) => {
    setKeys([newKey, ...keys]);
    if (!activeKey) setActiveKey(newKey);
  };

  const handleKeyDeleted = (deletedId) => {
    setKeys(keys.filter(k => k.id !== deletedId));
    if (activeKey && activeKey.id === deletedId) {
      setActiveKey(null);
    }
  };

  return (
    <main className="container">
      <div className="header-actions">
        <h1 className="title">AI Model Setup</h1>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <KeyDropdown 
            keys={keys} 
            activeKey={activeKey} 
            onSelect={setActiveKey} 
          />
        )}
      </div>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: '1.6' }}>
        <strong>Admin Control Center</strong><br />
        Manage your LLM endpoint API keys securely. All keys are encrypted at rest using AES-256-GCM.
        Never expose plain text to the browser.
      </p>

      {activeKey && (
        <ModelPlayground activeKey={activeKey} />
      )}

      <ApiKeyManager 
        keys={keys} 
        onKeyAdded={handleKeyAdded} 
        onKeyDeleted={handleKeyDeleted} 
      />
    </main>
  );
}
