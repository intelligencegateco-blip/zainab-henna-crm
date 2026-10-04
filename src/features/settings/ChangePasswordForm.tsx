import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useForm } from '../../hooks/useForm';
import { ValidationError } from '../../lib/validation';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';

/** Change your own password. Used in Settings and for the first sign-in with a temporary password. */
export function ChangePasswordForm({ submitLabel = 'Change password', onDone }: { submitLabel?: string; onDone?: () => void }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const { bind, errors } = form;

  const save = () =>
    form.submit(async (v) => {
      if (v.newPassword !== v.confirm) throw new ValidationError({ confirm: 'The two new passwords don’t match' });
      if (v.newPassword.length < 10) throw new ValidationError({ newPassword: 'Use at least 10 characters' });
      await changePassword(v.currentPassword, v.newPassword);
      toast.success('Password changed');
      form.setValues({ currentPassword: '', newPassword: '', confirm: '' });
      onDone?.();
    });

  return (
    <form
      className="form-grid"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {form.formError && <div className="form-alert span-2">{form.formError}</div>}
      <Field label="Current password" error={errors.currentPassword} className="span-2">
        {(p) => <Input {...p} {...bind('currentPassword')} type="password" autoComplete="current-password" />}
      </Field>
      <Field label="New password" error={errors.newPassword} hint="At least 10 characters. A short sentence works well.">
        {(p) => <Input {...p} {...bind('newPassword')} type="password" autoComplete="new-password" />}
      </Field>
      <Field label="Repeat new password" error={errors.confirm}>
        {(p) => <Input {...p} {...bind('confirm')} type="password" autoComplete="new-password" />}
      </Field>
      <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
