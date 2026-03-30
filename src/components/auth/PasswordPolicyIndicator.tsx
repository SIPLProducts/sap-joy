import { Check, X } from 'lucide-react';
import { getPasswordStrengthIndicators, PASSWORD_POLICY } from '@/lib/passwordPolicy';

interface PasswordPolicyIndicatorProps {
  password: string;
}

export function PasswordPolicyIndicator({ password }: PasswordPolicyIndicatorProps) {
  const indicators = getPasswordStrengthIndicators(password);

  if (!password) return null;

  const rules = [
    { label: `Min ${PASSWORD_POLICY.minLength} characters`, met: indicators.meetsMinLength },
    { label: `Max ${PASSWORD_POLICY.maxLength} characters`, met: indicators.withinMaxLength },
    { label: 'At least one letter', met: indicators.hasLetter },
    { label: 'At least one number', met: indicators.hasNumber },
  ];

  return (
    <div className="space-y-1 mt-2">
      <p className="text-xs font-medium text-muted-foreground">Password requirements:</p>
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-center gap-1.5 text-xs">
          {rule.met ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <X className="w-3 h-3 text-destructive" />
          )}
          <span className={rule.met ? 'text-green-600' : 'text-muted-foreground'}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
}
