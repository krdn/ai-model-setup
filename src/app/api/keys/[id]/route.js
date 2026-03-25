import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, maskKey } from '@/lib/crypto';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await prisma.apiKey.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, key, baseUrl, providerName, selectedModel } = body;
    
    let updateData = {};
    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (selectedModel !== undefined) updateData.selectedModel = selectedModel;
    
    if (providerName) {
      const provider = await prisma.provider.upsert({
        where: { name: providerName },
        update: {},
        create: { name: providerName },
      });
      updateData.providerId = provider.id;
    }
    
    if (key !== undefined) {
      if (key === '') {
        updateData.keyData = null;
        updateData.maskedKey = null;
      } else {
        updateData.keyData = encrypt(key);
        updateData.maskedKey = maskKey(key);
      }
    }
    
    const updated = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      include: { provider: true }
    });
    
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      maskedKey: updated.maskedKey,
      baseUrl: updated.baseUrl,
      selectedModel: updated.selectedModel,
      provider: updated.provider.name
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
