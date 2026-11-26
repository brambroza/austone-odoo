'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Labelled submit button that asks before submitting. With `formAction` it sends the surrounding form
 * to a different server action than the form's own (e.g. "apply to all" next to "save").
 * Disabled while the form is pending.
 */
export function ConfirmSubmit({ children, confirm, formAction, icon, variant = 'outline', disabled }: {
  children: ReactNode;
  confirm: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      formAction={formAction}
      disabled={disabled || pending}
      onClick={(event) => { if (!window.confirm(confirm)) event.preventDefault(); }}
    >
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}
