'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

type Props = {
  getBlob: () => Promise<Blob>;
  filename: string;
  label?: string;
};

export default function SaveDocxButton({ getBlob, filename, label = 'Save as DOCX' }: Props) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Saved.');
    } catch (err) {
      console.error(err);
      toast.error('Could not save the document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button variant='outline' onClick={handleSave} disabled={saving}>
      <Download className='w-4 h-4 mr-2' />
      {saving ? 'Saving…' : label}
    </Button>
  );
}
