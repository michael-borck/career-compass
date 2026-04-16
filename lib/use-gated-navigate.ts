'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { checkGate, type GatedAction } from './action-gate';

type ModalState = {
  action: GatedAction;
  path: string;
  preNavigate?: () => void;
} | null;

export function useGatedNavigate() {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>(null);

  const gatedPush = useCallback(
    (action: GatedAction, path: string, preNavigate?: () => void) => {
      const gate = checkGate(action);
      if (gate.canProceed) {
        preNavigate?.();
        router.push(path);
        return;
      }
      setModalState({ action, path, preNavigate });
    },
    [router]
  );

  const handleContinue = useCallback(() => {
    if (!modalState) return;
    modalState.preNavigate?.();
    router.push(modalState.path);
    setModalState(null);
  }, [modalState, router]);

  const handleClose = useCallback(() => {
    setModalState(null);
  }, []);

  const modalProps = {
    action: (modalState?.action ?? 'gaps') as GatedAction,
    open: modalState !== null,
    onClose: handleClose,
    onContinue: handleContinue,
  };

  return { gatedPush, modalProps };
}
