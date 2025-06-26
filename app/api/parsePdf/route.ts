import { normalizeText } from '@/lib/utils';
import { getFileProcessor, isFileTypeSupported } from '@/lib/file-processors';
import { NextRequest } from 'next/server';

interface FileParseRequest {
  fileData: number[]; // Array of bytes from the file
  filename: string; // Original filename to determine file type
}

export async function POST(request: NextRequest) {
  try {
    const { fileData, filename } = (await request.json()) as FileParseRequest;

    if (!isFileTypeSupported(filename)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
      });
    }

    // Convert the array of bytes back to Buffer
    const buffer = Buffer.from(fileData);
    
    // Get the appropriate processor for this file type
    const processor = getFileProcessor(filename);
    const extractedText = await processor.processFile(buffer);
    const normalizedText = normalizeText(extractedText);

    return new Response(JSON.stringify(normalizedText), {
      status: 200,
    });
  } catch (error) {
    console.error('File parsing error:', error);
    return new Response(JSON.stringify({ error: 'Failed to parse file' }), {
      status: 500,
    });
  }
}
