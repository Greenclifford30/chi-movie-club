"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleGroupProps {
  value?: string[]
  onValueChange?: (value: string[]) => void
  children: React.ReactNode
  className?: string
}

interface ToggleGroupItemProps {
  value: string
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

const ToggleGroupContext = React.createContext<{
  value: string[]
  onValueChange: (value: string[]) => void
} | null>(null)

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, value = [], onValueChange = () => {}, children, ...props }, ref) => {
    return (
      <ToggleGroupContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn("flex flex-wrap gap-2", className)}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    )
  }
)
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)
    if (!context) throw new Error("ToggleGroupItem must be used within ToggleGroup")

    const { value: selectedValues, onValueChange } = context
    const isSelected = selectedValues.includes(value)

    const handleClick = () => {
      if (disabled) return
      
      if (isSelected) {
        onValueChange(selectedValues.filter(v => v !== value))
      } else {
        onValueChange([...selectedValues, value])
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
          "h-9 px-3",
          isSelected && "bg-primary text-primary-foreground border-primary",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }