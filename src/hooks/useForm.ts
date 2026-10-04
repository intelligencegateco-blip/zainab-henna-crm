import { useCallback, useState, type ChangeEvent } from 'react';
import { ValidationError } from '../lib/validation';

type Values = Record<string, string | boolean>;

/**
 * Tiny form helper: string/boolean values, field errors from ValidationError,
 * and a submitting flag. Validation itself lives in lib/validation (zod).
 */
export function useForm<T extends Values>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  /** Props for a text-like input/select/textarea bound to `key`. */
  const bind = (key: keyof T & string) => ({
    name: key,
    value: String(values[key] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValue(key, e.target.value as T[typeof key]),
  });

  const bindCheck = (key: keyof T & string) => ({
    name: key,
    checked: Boolean(values[key]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValue(key, e.target.checked as T[typeof key]),
  });

  /** Runs `fn`; maps ValidationError to field errors, anything else to a form-level message. */
  const submit = async (fn: (values: T) => Promise<unknown>): Promise<boolean> => {
    setSubmitting(true);
    setFormError(null);
    try {
      await fn(values);
      return true;
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields);
        if (err.fields._form) setFormError(err.fields._form);
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValue, setValues, errors, setErrors, formError, submitting, bind, bindCheck, submit };
}
