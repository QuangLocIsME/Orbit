'use client'

import 'sonner/dist/styles.css'
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      closeButton
      position="bottom-right"
      {...props}
    />
  )
}

export { Toaster, toast }
