'use client';
import { useState } from 'react';

export default function ModelPlayground({ activeKey }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!activeKey) return null;

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse('');
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: activeKey.id, prompt })
      });
      
      const data = await res.json();
      if (res.ok) {
        setResponse(data.response || 'No response returned from the model.');
      } else {
        setError(data.error || 'Failed to get response.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error executing prompt.');
    }
    setLoading(false);
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '30px', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>LLM Playground - Test Your Model</h3>
      <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Currently testing: <strong>{activeKey.provider}</strong> {activeKey.selectedModel ? <span style={{color:'#10b981'}}>({activeKey.selectedModel})</span> : <span style={{color:'var(--danger)'}}>(No specific model selected, using default)</span>}
      </p>
      
      <div className="form-group">
        <textarea 
          className="input" 
          rows="4" 
          placeholder="Enter a prompt to test your configured model (e.g., 'Hello, what model are you?')"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ resize: 'vertical' }}
        ></textarea>
      </div>

      <button className="btn" style={{ background: '#3b82f6', marginBottom: '20px' }} onClick={handleSend} disabled={loading || !prompt.trim()}>
        {loading ? 'Sending Request...' : 'Send Prompt'}
      </button>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>{error}</div>}
      
      {response && (
        <div style={{ marginTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#94a3b8' }}>Response:</h4>
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--card-border)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {response}
          </div>
        </div>
      )}
    </div>
  );
}
