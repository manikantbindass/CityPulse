import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = cva('button', {
  variants: {
    variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost' },
    size: { default: '', sm: 'button-sm' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
}
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />;
}
