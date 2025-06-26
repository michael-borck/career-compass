import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface FileProcessor {
  processFile(buffer: Buffer): Promise<string>;
}

export class PDFProcessor implements FileProcessor {
  async processFile(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }
}

export class MarkdownProcessor implements FileProcessor {
  async processFile(buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8');
  }
}

export class DOCXProcessor implements FileProcessor {
  async processFile(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}

export function getFileProcessor(filename: string): FileProcessor {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  switch (extension) {
    case '.pdf':
      return new PDFProcessor();
    case '.md':
      return new MarkdownProcessor();
    case '.docx':
    case '.doc':
      return new DOCXProcessor();
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

export function getSupportedFileTypes(): string[] {
  return ['.pdf', '.md', '.docx', '.doc'];
}

export function isFileTypeSupported(filename: string): boolean {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return getSupportedFileTypes().includes(extension);
}