import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/gon/projects/ai-agent/ai-model-setup/.env' });

const prisma = new PrismaClient();

const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_KEY;

function decrypt(text) {
  if (!text) return '';
  const [ivHex, authTagHex, encryptedHex] = text.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) return '';

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let result = decipher.update(encryptedHex, 'hex', 'utf8');
  result += decipher.final('utf8');
  return result;
}

async function run() {
  const keys = await prisma.apiKey.findMany({ include: { provider: true } });
  const ollamaKeyConfig = keys.find(k => k.provider.name.toLowerCase().includes('ollama') || k.baseUrl?.includes('ollama.krdn.kr'));
  
  if (!ollamaKeyConfig) {
     console.log('No ollama config found in DB!');
     process.exit(1);
  }
  
  console.log('Found config:', ollamaKeyConfig.name);
  const key = decrypt(ollamaKeyConfig.keyData);
  const model = ollamaKeyConfig.selectedModel || 'llama3';
  console.log('Testing with model:', model);
  
  const baseUrlsToTest = [
     'https://ollama.krdn.kr/api',
     'https://ollama.krdn.kr/v1',
     'https://ollama.krdn.kr/api/v1',
     'https://ollama.krdn.kr/ollama/api',
     'https://ollama.krdn.kr/ollama/v1',
     'https://ollama.krdn.kr'
  ];
  
  for (const base of baseUrlsToTest) {
      console.log(`\n--- Testing Base URL: ${base} ---`);
      
      // Try /chat/completions (OpenAI compat)
      let endpoint = `${base}/chat/completions`;
      try {
         const res = await fetch(endpoint, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${key}`
           },
           body: JSON.stringify({
             model: model,
             messages: [{ role: 'user', content: "Hello" }]
           })
         });
         const text = await res.text();
         console.log(`[OpenAI POST] Status: ${res.status} ${res.statusText}`);
         console.log(`Response: ${text.substring(0, 150)}`);
         if (res.ok) {
           console.log('✅ THIS ENDPOINT WORKS!');
           process.exit(0);
         }
      } catch(e) { console.log('Fetch error:', e.message); }
      
      // Try /api/generate (Ollama native compat)
      let endpoint2 = `${base}/api/generate`;
      if (base === 'https://ollama.krdn.kr') endpoint2 = `${base}/ollama/api/generate`;
      try {
         const res = await fetch(endpoint2, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${key}`
           },
           body: JSON.stringify({
             model: model,
             prompt: "Hello",
             stream: false
           })
         });
         const text = await res.text();
         console.log(`[Ollama POST] Status: ${res.status} ${res.statusText}`);
         console.log(`Response: ${text.substring(0, 150)}`);
         if (res.ok) {
           console.log(`✅ OLLAMA GENERATE WORKS at ${endpoint2}!`);
           process.exit(0);
         }
      } catch(e) {}
  }
}
run();
