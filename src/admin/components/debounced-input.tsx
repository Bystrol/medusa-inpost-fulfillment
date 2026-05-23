import { Input } from "@medusajs/ui"
import { ComponentPropsWithoutRef, useEffect, useState } from "react"

type DebouncedInputProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "onChange" | "value"
> & {
  value: string
  delay?: number
  onDebouncedChange: (value: string) => void
}

export function DebouncedInput({
  value,
  delay = 300,
  onDebouncedChange,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (localValue === value) {
      return
    }

    const timeout = window.setTimeout(() => {
      onDebouncedChange(localValue)
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [delay, localValue, onDebouncedChange, value])

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
    />
  )
}
