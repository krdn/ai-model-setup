import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export const maxDuration = 30; // 30 seconds to allow LLM requests

export async function POST(request) {
  try {
    const { keyId, prompt } = await request.json();
    if (!keyId || !prompt) return NextResponse.json({ error: 'Missing keyId or prompt' }, { status: 400 });

    const config = await prisma.apiKey.findUnique({ where: { id: keyId }, include: { provider: true } });
    if (!config) return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });

    const key = config.keyData ? decrypt(config.keyData) : '';
    const providerId = config.provider.name.toLowerCase();
    const model = config.selectedModel || 'default';
    let baseUrl = config.baseUrl;

    let responseText = '';

    if (providerId.includes('anthropic') || providerId.includes('claude')) {
      if (!baseUrl) baseUrl = 'https://api.anthropic.com/v1';
      const endpoint = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model === 'default' ? 'claude-3-5-sonnet-20241022' : model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error');
      responseText = data.content?.[0]?.text || '';

    } else if (providerId.includes('gemini') || providerId.includes('google')) {
      const geminiModel = model === 'default' ? 'gemini-1.5-pro' : model;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini API error');
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (providerId.includes('ollama')) {
       if (!baseUrl) baseUrl = 'http://localhost:11434';
       
       let base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
       const endpointsToTry = [
          base.includes('/v1') || base.includes('/api') ? `${base}/chat/completions` : null,
          `${base}/api/chat/completions`,
          `${base}/v1/chat/completions`,
          `${base}/api/generate`
       ].filter(Boolean);

       let isSuccess = false;
       let lastError = null;

       for (const endpoint of endpointsToTry) {
           try {
               const isChatCompletion = endpoint.includes('/chat/completions');
               const headers = { 'Content-Type': 'application/json' };
               if (key) headers['Authorization'] = `Bearer ${key}`;
               
               const requestBody = isChatCompletion 
                   ? { model: model === 'default' ? 'llama3' : model, messages: [{ role: 'user', content: prompt }] }
                   : { model: model === 'default' ? 'llama3' : model, prompt: prompt, stream: false };

               const res = await fetch(endpoint, {
                 method: 'POST',
                 headers,
                 body: JSON.stringify(requestBody)
               });
               
               const text = await res.text();
               if (!res.ok) {
                  let data = {};
                  try { data = JSON.parse(text); } catch(e){}
                  if (res.status === 405 || data.detail === "Method Not Allowed") continue;
                  if (res.status === 404 || data.detail === "Not Found" || text.trim().startsWith('<')) continue;
                  
                  if (res.status === 401 || data.detail === "Not authenticated") {
                     lastError = new Error("인증 실패(401). Open WebUI 환경이 감지되었습니다. 프롬프트 전송을 위해 Edit 버튼을 눌러 JWT API Key를 입력해주세요.");
                     break; 
                  }
                  lastError = new Error(data.error?.message || data.detail || `Ollama/WebUI 서버 통신 에러 (${res.status})`);
                  continue; 
               }

               const data = JSON.parse(text);
               responseText = isChatCompletion 
                  ? (data.choices?.[0]?.message?.content || '') 
                  : (data.response || '');
               isSuccess = true;
               break; 
           } catch(e) {
               lastError = e;
           }
       }
       
       if (!isSuccess) {
           throw lastError || new Error("지원되는 API 경로 탐색에 실패했습니다 (서버 응답 없음). URL 설정을 확인하세요.");
       }
    } else {
      // DEFAULT: OPENAI COMPATIBLE
      if (!baseUrl) {
          if (providerId.includes('openai')) baseUrl = 'https://api.openai.com/v1';
          if (providerId.includes('deepseek')) baseUrl = 'https://api.deepseek.com/v1';
          if (providerId.includes('moonshot') || providerId.includes('kimi')) baseUrl = 'https://api.moonshot.cn/v1';
          if (providerId.includes('xai')) baseUrl = 'https://api.x.ai/v1';
          if (providerId.includes('openrouter')) baseUrl = 'https://openrouter.ai/api/v1';
          if (providerId.includes('zhipu') || providerId.includes('glm')) baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
      }
      
      const endpoint = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model === 'default' ? 'gpt-3.5-turbo' : model,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'OpenAI API error');
      responseText = data.choices?.[0]?.message?.content || '';
    }

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute prompt' }, { status: 500 });
  }
}
