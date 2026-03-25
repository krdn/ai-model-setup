'use client';

import { useState } from 'react';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI (ChatGPT)', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'sk-...', keyPrefix: 'sk-' },
  { id: 'anthropic', name: 'Anthropic (Claude)', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'sk-ant-...', keyPrefix: 'sk-ant-' },
  { id: 'gemini', name: 'Google Gemini', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'AIzaSy...', keyPrefix: '' },
  { id: 'kimi', name: 'Moonshot (Kimi)', defaultBaseUrl: 'https://api.moonshot.cn/v1', requiresKey: true, keyPlaceholder: 'sk-...', keyPrefix: 'sk-' },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', requiresKey: true, keyPlaceholder: 'sk-...', keyPrefix: 'sk-' },
  { id: 'zhipu', name: 'Zhipu (GLM-4)', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'jwt token...', keyPrefix: '' },
  { id: 'ollama', name: 'Ollama (Local)', defaultBaseUrl: 'http://localhost:11434', requiresKey: false, keyPlaceholder: '', keyPrefix: '' },
  { id: 'xai', name: 'xAI (Grok)', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'xai-...', keyPrefix: 'xai-' },
  { id: 'openrouter', name: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', requiresKey: true, keyPlaceholder: 'sk-or-...', keyPrefix: 'sk-or-' },
  { id: 'custom', name: 'Custom Provider', defaultBaseUrl: '', requiresKey: true, keyPlaceholder: 'API Key...', keyPrefix: '' }
];

export default function ApiKeyManager({ keys, onKeyAdded, onKeyDeleted }) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProviderObj, setSelectedProviderObj] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', key: '', providerName: '', baseUrl: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Testing & Model Selection state
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testingStatus, setTestingStatus] = useState('idle'); // 'loading', 'success', 'error'
  const [testingError, setTestingError] = useState('');
  const [fetchedModels, setFetchedModels] = useState([]);
  const [selectedModelString, setSelectedModelString] = useState('');

  // Editing state
  const [editingKeyId, setEditingKeyId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', key: '', baseUrl: '' });

  const handleProviderSelect = (p) => {
    setSelectedProviderObj(p);
    setFormData({
      name: `${p.name} Setup`,
      key: '',
      providerName: p.name,
      baseUrl: p.defaultBaseUrl || ''
    });
    setErrorMsg('');
  };

  const handleEditClick = (k) => {
    setEditingKeyId(k.id);
    setEditFormData({
      name: k.name,
      key: '', // Do not populate encrypted key
      baseUrl: k.baseUrl || ''
    });
    setTestingKeyId(null);
  };

  const handleUpdate = async (id) => {
    try {
      const payload = {
        name: editFormData.name,
        baseUrl: editFormData.baseUrl
      };
      if (editFormData.key.trim() !== '') {
        payload.key = editFormData.key.trim();
      }
      
      const res = await fetch(`/api/keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingKeyId(null);
        window.location.reload(); // Quick refresh to sync all components
      } else {
        alert('Failed to update configuration.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during update.');
    }
  };

  const validateForm = () => {
    if (selectedProviderObj?.requiresKey && !formData.key) {
      return 'API Key is required for this provider.';
    }
    if (selectedProviderObj?.keyPrefix && formData.key && !formData.key.startsWith(selectedProviderObj.keyPrefix)) {
      return `API Key for ${selectedProviderObj.name} usually starts with "${selectedProviderObj.keyPrefix}". Please verify your key.`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    const validationError = validateForm();
    if (validationError) {
      // Allow overriding the validation warning
      if (!confirm(validationError + '\n\nDo you want to save anyway?')) {
        return;
      }
    }
    
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        providerName: formData.providerName,
        key: formData.key || '',
        baseUrl: selectedProviderObj.id === 'custom' || selectedProviderObj.defaultBaseUrl ? formData.baseUrl : ''
      };
      
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newKey = await res.json();
        onKeyAdded(newKey);
        setSelectedProviderObj(null);
        setIsAdding(false);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to add configuration');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error occurred.');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onKeyDeleted(id);
        if (testingKeyId === id) setTestingKeyId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestConnection = async (id) => {
    if (testingKeyId === id && testingStatus === 'success') {
      setTestingKeyId(null);
      return;
    }
    
    setTestingKeyId(id);
    setTestingStatus('loading');
    setTestingError('');
    setFetchedModels([]);
    setSelectedModelString('');

    try {
      const res = await fetch(`/api/keys/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestingStatus('success');
        setFetchedModels(data.models || []);
        
        const currentKey = keys.find(k => k.id === id);
        if (currentKey && currentKey.selectedModel) {
          if (!data.models.includes(currentKey.selectedModel)) {
            setFetchedModels([currentKey.selectedModel, ...(data.models || [])]);
          }
          setSelectedModelString(currentKey.selectedModel);
        } else if (data.models && data.models.length > 0) {
          setSelectedModelString(data.models[0]);
        }
      } else {
        setTestingStatus('error');
        setTestingError(data.error || 'Connection failed.');
      }
    } catch (err) {
      console.error(err);
      setTestingStatus('error');
      setTestingError('Network error connecting to the server.');
    }
  };

  const handleSaveModel = async (id) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: selectedModelString })
      });
      if (res.ok) {
        // Force full refresh to sync parent states
        window.location.reload(); 
      } else {
        alert('Failed to save selected model');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-panel" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Available Models & Keys</h2>
        {!isAdding && (
          <button className="btn" onClick={() => setIsAdding(true)}>+ Add New Model Setup</button>
        )}
      </div>

      {isAdding && (
        <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Select Provider</h3>
          <div className="provider-grid">
            {PROVIDERS.map(p => (
              <div 
                key={p.id} 
                className={`provider-tile ${selectedProviderObj?.id === p.id ? 'selected' : ''}`}
                onClick={() => handleProviderSelect(p)}
              >
                <div className="provider-name">{p.name}</div>
              </div>
            ))}
          </div>

          {selectedProviderObj && (
            <form onSubmit={handleSubmit} style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              {errorMsg && <div style={{ color: 'var(--danger)', marginBottom: '15px' }}>{errorMsg}</div>}
              
              <div className="form-group">
                <label>Configuration Name</label>
                <input 
                  className="input" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Production Setup"
                />
              </div>

              <div className="form-group">
                <label>API Key {selectedProviderObj.requiresKey ? '(Encrypted securely)' : '(Optional for local)'}</label>
                <input 
                  className="input" 
                  type="password"
                  required={selectedProviderObj.requiresKey}
                  value={formData.key}
                  onChange={e => setFormData({...formData, key: e.target.value})}
                  placeholder={selectedProviderObj.keyPlaceholder || 'Optional Key...'}
                />
              </div>

              {(selectedProviderObj.defaultBaseUrl || selectedProviderObj.id === 'custom' || !selectedProviderObj.requiresKey) && (
                <div className="form-group">
                  <label>Base URL EndPoint</label>
                  <input 
                    className="input" 
                    value={formData.baseUrl}
                    onChange={e => setFormData({...formData, baseUrl: e.target.value})}
                    placeholder="https://..."
                    required={!selectedProviderObj.requiresKey}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
                <button className="btn" type="button" style={{ background: '#475569' }} onClick={() => {
                  setIsAdding(false);
                  setSelectedProviderObj(null);
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="key-list">
        {keys.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No models configured. Add one above.</p>}
        {keys.map(k => (
          <div className="key-item" key={k.id} style={{ display: 'block' }}>
            {editingKeyId === k.id ? (
              <div style={{ padding: '10px' }}>
                <div className="form-group">
                  <label>Configuration Name</label>
                  <input className="input" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Base URL EndPoint</label>
                  <input className="input" value={editFormData.baseUrl} onChange={e => setEditFormData({...editFormData, baseUrl: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>API Key (Leave blank to keep current key)</label>
                  <input className="input" type="password" placeholder="Leave blank to keep current..." value={editFormData.key} onChange={e => setEditFormData({...editFormData, key: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn" style={{ background: '#3b82f6' }} onClick={() => handleUpdate(k.id)}>Save Changes</button>
                  <button className="btn" style={{ background: '#475569' }} onClick={() => setEditingKeyId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="key-info">
                    <h3>{k.name}</h3>
                    <div className="key-meta">
                      <span className="badge">{k.provider}</span>
                      {k.maskedKey && <span>{k.maskedKey}</span>}
                      {k.baseUrl && <span>{k.baseUrl}</span>}
                      {k.selectedModel ? (
                        <span style={{ color: '#10b981' }}>Model: <strong>{k.selectedModel}</strong></span>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>No model selected</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                     <button className="btn" style={{ background: '#475569' }} onClick={() => handleEditClick(k)}>Edit</button>
                     <button 
                      className="btn" 
                      style={{ background: testingKeyId === k.id && testingStatus === 'success' ? '#475569' : '#10b981' }} 
                      onClick={() => handleTestConnection(k.id)}
                     >
                       {testingKeyId === k.id && testingStatus === 'success' ? 'Close' : 'Test & Select'}
                     </button>
                     <button className="btn btn-danger" onClick={() => handleDelete(k.id)}>Delete</button>
                  </div>
                </div>

                {testingKeyId === k.id && (
                   <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                     {testingStatus === 'loading' && <div style={{ color: 'var(--text-secondary)' }}>Testing connection and fetching models...</div>}
                     {testingStatus === 'error' && <div style={{ color: 'var(--danger)', fontWeight: '500' }}>Error: {testingError}</div>}
                     {testingStatus === 'success' && (
                        <div>
                          <div style={{ color: '#10b981', marginBottom: '16px', fontWeight: '500' }}>✅ Connection Successful! Fetched {fetchedModels.length} models.</div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                             <label>Select Default Model</label>
                             <div style={{ display: 'flex', gap: '8px' }}>
                               <select 
                                 className="input" 
                                 style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)' }}
                                 value={selectedModelString}
                                 onChange={(e) => setSelectedModelString(e.target.value)}
                               >
                                 <option value="" disabled>-- Choose a Model --</option>
                                 {fetchedModels.map(m => (
                                   <option key={m} value={m}>{m}</option>
                                 ))}
                               </select>
                               <button className="btn" style={{ background: '#3b82f6' }} onClick={() => handleSaveModel(k.id)}>Save Model</button>
                             </div>
                          </div>
                        </div>
                     )}
                   </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
