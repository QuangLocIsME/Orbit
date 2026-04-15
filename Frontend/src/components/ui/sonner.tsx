"use client";

import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      closeButton
      position="bottom-right"
      {...props}
    />
  );
};

export { Toaster, toast };