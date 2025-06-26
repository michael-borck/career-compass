'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';

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
      'text/plain', // for .md files that might not have proper MIME type
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
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
      className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="space-y-4">
        <div className="text-6xl text-gray-400">📄</div>
        <div>
          <p className="text-lg font-medium text-gray-900">Drop your resume here</p>
          <p className="text-sm text-gray-500">or click to browse files</p>
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
            Choose File
          </label>
        </Button>
        <p className="text-xs text-gray-400">PDF, Markdown, and DOCX files supported - processed locally</p>
      </div>
    </div>
  );
}