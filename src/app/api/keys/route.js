import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, maskKey } from '@/lib/crypto';

export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      include: { provider: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // We never return keyData to the frontend, only masked data
    const safeKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      maskedKey: k.maskedKey,
      baseUrl: k.baseUrl,
      selectedModel: k.selectedModel,
      provider: k.provider.name,
      providerId: k.provider.id,
      createdAt: k.createdAt
    }));
    
    return NextResponse.json(safeKeys);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch API configurations' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, key, baseUrl, providerName } = await request.json();
    
    if (!name || !providerName) {
      return NextResponse.json({ error: 'Missing required configuration' }, { status: 400 });
    }
    
    // Upsert the provider
    const provider = await prisma.provider.upsert({
      where: { name: providerName },
      update: {},
      create: { name: providerName },
    });
    
    let encryptedKey = null;
    let masked = null;
    
    if (key) {
      encryptedKey = encrypt(key);
      masked = maskKey(key);
    }
    
    const newKey = await prisma.apiKey.create({
      data: {
        name,
        keyData: encryptedKey,
        maskedKey: masked,
        baseUrl: baseUrl || null,
        providerId: provider.id
      }
    });
    
    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      maskedKey: newKey.maskedKey,
      baseUrl: newKey.baseUrl,
      selectedModel: newKey.selectedModel,
      provider: provider.name
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to add model config' }, { status: 500 });
  }
}
