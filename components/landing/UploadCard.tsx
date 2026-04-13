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
    <div className='border border-border rounded-lg p-6 bg-paper flex flex-col gap-4 w-full max-w-xl'>
      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-1'>
          Upload &amp; Explore
        </h2>
        <p className='text-ink-muted text-[var(--text-sm)]'>
          Resume, a few words, or a job title. Any combination works.
        </p>
      </div>

      <LocalFileUpload
        onFileSelect={(file) => {
          setSelectedFile(file);
          setFileName(file.name);
        }}
      />
      {fileName && (
        <p className='text-[var(--text-xs)] text-ink-muted -mt-2'>Selected: {fileName}</p>
      )}

      <Input
        placeholder='Job title (e.g., Data Analyst)'
        value={localJobTitle}
        onChange={(e) => setLocalJobTitle(e.target.value)}
      />

      <Textarea
        placeholder='Or a few words about your background, interests, goals…'
        value={localFreeText}
        onChange={(e) => setLocalFreeText(e.target.value)}
        rows={3}
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
