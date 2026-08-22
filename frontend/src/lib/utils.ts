import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui class merge utility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
