'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { fileToArrayBuffer } from '@/lib/utils';
import { useSessionStore } from '@/lib/session-store';
import { isLLMConfigured } from '@/lib/llm-client';

export default function UploadCard() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [localFreeText, setLocalFreeText] = useState('');
  const [localJobTitle, setLocalJobTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const store = useSessionStore();

  const disabled =
    !selectedFile && !localFreeText.trim() && !localJobTitle.trim();

  async function handleSubmit() {
    if (disabled) return;
    setLoading(true);
    try {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }

      if (selectedFile) {
        const arrayBuffer = await fileToArrayBuffer(selectedFile);
        const res = await fetch('/api/parsePdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: Array.from(new Uint8Array(arrayBuffer)),
            filename: selectedFile.name,
          }),
        });
        const text = await res.json();
        store.setResume(text, selectedFile.name);
      }

      store.setFreeText(localFreeText);
      store.setJobTitle(localJobTitle);
      store.setCareers(null); // force regeneration on /careers

      router.push('/careers');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='border border-border rounded-lg p-8 bg-paper flex flex-col gap-5 w-full max-w-xl'>
      <div>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink mb-2'>
          Upload & Explore
        </h2>
        <p className='text-ink-muted text-[var(--text-sm)]'>
          Upload a resume, describe yourself, or just tell us a job title you're
          curious about. Any combination works.
        </p>
      </div>

      <LocalFileUpload
        onFileSelect={(file) => {
          setSelectedFile(file);
          setFileName(file.name);
        }}
      />
      {fileName && (
        <p className='text-[var(--text-sm)] text-ink-muted'>Selected: {fileName}</p>
      )}

      <Textarea
        placeholder='Or describe your background, interests, and goals.'
        value={localFreeText}
        onChange={(e) => setLocalFreeText(e.target.value)}
        rows={4}
      />

      <Input
        placeholder='Or just tell me a job title (e.g., Data Analyst)'
        value={localJobTitle}
        onChange={(e) => setLocalJobTitle(e.target.value)}
      />

      <Button
        onClick={handleSubmit}
        disabled={disabled || loading}
        className='w-full'
      >
        {loading ? 'Working…' : 'Find my careers'}
      </Button>
    </div>
  );
}
