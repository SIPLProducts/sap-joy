import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  drillDownUrl?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20',
  success: 'bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20',
  warning: 'bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/20',
  destructive: 'bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20',
  info: 'bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20',
};

const iconStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  destructive: 'text-destructive',
  info: 'text-blue-600',
};

export function KPICard({ title, value, subtitle, icon: Icon, variant = 'default', drillDownUrl, onClick }: KPICardProps) {
  const content = (
    <Card className={cn(variantStyles[variant], drillDownUrl || onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : '')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-5 w-5', iconStyles[variant])} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  if (drillDownUrl) {
    return <Link to={drillDownUrl}>{content}</Link>;
  }

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return content;
}
