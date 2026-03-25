import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export const maxDuration = 10; // Avoid timeouts hanging

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const config = await prisma.apiKey.findUnique({ where: { id }, include: { provider: true } });
    if (!config) return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });

    const key = config.keyData ? decrypt(config.keyData) : '';
    const providerId = config.provider.name.toLowerCase();
    
    let baseUrl = config.baseUrl;
    let models = [];
    let isSuccess = false;

    if (providerId.includes('openai') || providerId.includes('deepseek') || providerId.includes('moonshot') || providerId.includes('kimi') || providerId.includes('xai') || providerId.includes('openrouter') || providerId.includes('zhipu') || providerId.includes('glm')) {
       if (!baseUrl) {
          if (providerId.includes('openai')) baseUrl = 'https://api.openai.com/v1';
          if (providerId.includes('deepseek')) baseUrl = 'https://api.deepseek.com/v1';
          if (providerId.includes('moonshot') || providerId.includes('kimi')) baseUrl = 'https://api.moonshot.cn/v1';
          if (providerId.includes('xai')) baseUrl = 'https://api.x.ai/v1';
          if (providerId.includes('openrouter')) baseUrl = 'https://openrouter.ai/api/v1';
       }
       
       if (baseUrl) {
         try {
           const res = await fetch(`${baseUrl}/models`, {
             headers: { 'Authorization': `Bearer ${key}` }
           });
           if (res.ok) {
             isSuccess = true;
             const data = await res.json();
             models = data.data ? data.data.map(m => m.id) : [];
           }
         } catch (e) { console.error('Fetch models failed', e); }
       }
    } else if (providerId.includes('gemini') || providerId.includes('google')) {
       try {
         const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
         if (res.ok) {
           isSuccess = true;
           const data = await res.json();
           models = data.models ? data.models.map(m => m.name.replace('models/', '')) : [];
         }
       } catch (e) { console.error(e); }
    } else if (providerId.includes('ollama')) {
       if (!baseUrl) baseUrl = 'http://localhost:11434';
       
       const endpoints = [
         `${baseUrl}/api/tags`,
         `${baseUrl}/api/models`,
         `${baseUrl}/v1/models`,
         `${baseUrl}/ollama/api/tags`
       ];
       
       let lastErrorDesc = '서버 주소(URL)를 확인해주세요.';
       
       for (const endpoint of endpoints) {
         try {
           const headers = key ? { 'Authorization': `Bearer ${key}` } : {};
           const res = await fetch(endpoint, { headers });
           const text = await res.text();
           
           if (!res.ok) {
             if (text.includes("Not authenticated") || res.status === 401 || res.status === 403) {
               lastErrorDesc = '이 서버는 Open WebUI로 보호되어 있습니다. [API Key]란에 WebUI에서 발급된 토큰 값을 입력하세요.';
             }
             continue; // Try next fallback
           }
           
           if (text.trim().startsWith('<')) continue; // skip HTML responses
           
           const data = JSON.parse(text);
           if (data.models) {
             models = data.models.map(m => m.name || m.id);
             isSuccess = true;
             break;
           } else if (data.data) {
             models = data.data.map(m => m.id);
             isSuccess = true;
             break;
           }
         } catch (e) {
           // Ignore network errors on specific paths and try the next one
         }
       }
       
       if (!isSuccess) {
         return NextResponse.json({ error: lastErrorDesc }, { status: 400 });
       }
    } else if (providerId.includes('anthropic') || providerId.includes('claude')) {
       isSuccess = true;
       models = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'];
    } else {
       isSuccess = true;
       models = ['default'];
    }

    if (!isSuccess) {
       return NextResponse.json({ error: 'Connection failed. Verify API Key or endpoint.' }, { status: 400 });
    }

    if (models.length === 0) {
      models = ['default'];
    }

    return NextResponse.json({ success: true, models });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal test execution error' }, { status: 500 });
  }
}
