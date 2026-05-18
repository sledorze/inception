import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function navLinkClass(isActive: boolean): string {
  return cn(
    'inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3 w-auto sm:w-full sm:justify-start',
    isActive ?
      'bg-muted text-foreground font-semibold sm:border-l-2 sm:border-ring'
    : 'hover:bg-accent hover:text-accent-foreground',
  )
}
