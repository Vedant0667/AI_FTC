/**
 * File Download API Route
 * Zips generated files and returns download
 */

import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';

interface RequestBody {
  files: Array<{
    path: string;
    content: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { files } = body;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Uint8Array[] = [];

    // Collect archive data
    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Handle archive completion
    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      archive.on('error', reject);
    });

    // Add files to archive
    for (const file of files) {
      // Clean up path (remove leading slash if present)
      const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;

      // Add file to archive
      archive.append(file.content, { name: cleanPath });
    }

    // Finalize archive
    await archive.finalize();

    // Wait for archive to complete
    const zipBuffer = await archivePromise;

    // Return zip file
    const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="ftc-code-${Date.now()}.zip"`,
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
