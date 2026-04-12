'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface LocalFileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
}

export default function LocalFileUpload({
  onFileSelect,
  accept = '.pdf,.md,.docx,.doc',
  className = ''
}: LocalFileUploadProps) {
  const isValidFileType = (file: File) => {
    const validTypes = [
      'application/pdf',
      'text/markdown',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const validExtensions = ['.pdf', '.md', '.docx', '.doc'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isValidFileType(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && isValidFileType(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div
      className={`border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-ink-muted transition-colors duration-[250ms] ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="space-y-4">
        <FileText className="w-12 h-12 text-ink-quiet mx-auto" />
        <div>
          <p className="text-[var(--text-lg)] font-medium text-ink">Drop your resume here</p>
          <p className="text-[var(--text-sm)] text-ink-quiet">or click to browse files</p>
        </div>
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <Button asChild variant="outline">
          <label htmlFor="file-upload" className="cursor-pointer">
            Choose file
          </label>
        </Button>
        <p className="text-[var(--text-xs)] text-ink-quiet">PDF, Markdown, and DOCX files supported &mdash; processed locally</p>
      </div>
    </div>
  );
}
