# Components Domain Best Practices Guide

> **Status**: Active
> **Domain**: `src/components/`
> **Last Updated**: 2025-11-28
> **Purpose**: Authoritative source of truth for component patterns, used by AI coding agents and PR gatekeeping

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Directory Structure](#2-directory-structure)
3. [CRITICAL: No Inline Styling Outside UI Directory](#3-critical-no-inline-styling-outside-ui-directory)
4. [Component Patterns](#4-component-patterns)
5. [CVA (Class Variance Authority)](#5-cva-class-variance-authority)
6. [Radix UI Integration](#6-radix-ui-integration)
7. [Prop Typing](#7-prop-typing)
8. [Styling Patterns](#8-styling-patterns)
9. [Feature Components](#9-feature-components)
10. [Import & Export Conventions](#10-import--export-conventions)
11. [Accessibility](#11-accessibility)
12. [Validation Checklist](#12-validation-checklist)
13. [References](#13-references)

---

## 1. Domain Overview

The Components domain contains all React UI components organized by purpose:

- **UI Primitives** (`ui/`) - Reusable, styled building blocks based on shadcn/ui
- **Feature Components** (`chat/`, `nav/`) - Domain-specific compositions
- **Shared Utilities** (`shared/`) - Cross-cutting concerns like error boundaries

### Core Principles

1. **UI components are presentation-only** - No business logic, database calls, or API requests
2. **Feature components compose UI primitives** - They integrate hooks/stores but delegate rendering
3. **All components follow shadcn/ui conventions** - React 19 patterns, data-slot attributes, CVA variants
4. **Accessibility is non-negotiable** - Radix primitives handle most; we preserve their behavior
5. **No inline styling outside `ui/`** - All styled primitives live in `ui/`, feature components only compose them

---

## 2. Directory Structure

```
src/components/
├── ui/                    # shadcn/ui primitives (button, dialog, input, etc.)
│   ├── button.tsx         # ONLY place for styled button
│   ├── card.tsx           # ONLY place for styled card
│   ├── dialog.tsx         # ONLY place for styled dialog
│   └── ...
├── chat/                  # Chat feature components (compose ui/ only)
│   ├── chat-input.tsx
│   ├── chat-message.tsx
│   └── ...
├── nav/                   # Navigation feature components (compose ui/ only)
│   ├── app-sidebar.tsx
│   ├── nav-folders.tsx
│   └── ...
└── shared/                # Shared utilities
    └── default-catch-boundary.tsx
```

### File Naming Rules

| Type | Pattern | Example |
|------|---------|---------|
| UI primitive | `kebab-case.tsx` | `dropdown-menu.tsx` |
| Feature component | `kebab-case.tsx` | `chat-message.tsx` |
| Compound component | Single file | `dialog.tsx` (contains Dialog, DialogContent, etc.) |

---

## 3. CRITICAL: No Inline Styling Outside UI Directory

> **This is the most important rule in the Components domain.**

### The Rule

**ALL styled UI primitives MUST live in `src/components/ui/`.** Feature components (`chat/`, `nav/`, `shared/`, routes, or anywhere else) MUST compose existing UI components - they MUST NOT create their own styled elements.

### Why This Matters

1. **Single source of truth** - Update a button style once, it updates everywhere
2. **Consistent theming** - Dark mode, brand colors, etc. work automatically
3. **Maintainability** - No hunting for scattered inline styles
4. **Atomic design** - Small primitives compose into larger features
5. **AI agent discipline** - Prevents agents from reinventing existing components

### Before Writing ANY Styled Element

**STOP and ask yourself:**

1. Does a UI component already exist for this? (`Button`, `Card`, `Input`, `Badge`, etc.)
2. Does an existing component have a variant for this? (`variant="outline"`, `size="sm"`)
3. Can I compose existing components to achieve this?

**Only if the answer is NO to all three** should you consider creating a new UI component in `ui/`.

### Good vs Bad Examples

#### Buttons

```typescript
// ✅ GOOD: Using existing Button component
import { Button } from "@/components/ui/button";

function FeatureComponent() {
  return (
    <Button variant="destructive" size="sm" onClick={handleDelete}>
      Delete
    </Button>
  );
}

// ❌ BAD: Creating inline styled button
function FeatureComponent() {
  return (
    <button
      className="h-8 px-3 rounded-md bg-destructive text-white hover:bg-destructive/90"
      onClick={handleDelete}
    >
      Delete
    </button>
  );
}

// ❌ BAD: Even with cn(), still wrong outside ui/
function FeatureComponent() {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
      onClick={handleClick}
    >
      Submit
    </button>
  );
}
```

#### Cards

```typescript
// ✅ GOOD: Using existing Card components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function ChatPreview({ chat }: { chat: Chat }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{chat.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{chat.preview}</p>
      </CardContent>
    </Card>
  );
}

// ❌ BAD: Creating inline styled card
function ChatPreview({ chat }: { chat: Chat }) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">
          {chat.title}
        </h3>
      </div>
      <div className="p-6 pt-0">
        <p>{chat.preview}</p>
      </div>
    </div>
  );
}
```

#### Inputs

```typescript
// ✅ GOOD: Using existing Input component
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function SearchForm() {
  return (
    <form>
      <Input placeholder="Search..." type="search" />
      <Textarea placeholder="Describe what you're looking for..." />
    </form>
  );
}

// ❌ BAD: Creating inline styled inputs
function SearchForm() {
  return (
    <form>
      <input
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        placeholder="Search..."
        type="search"
      />
      <textarea
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2"
        placeholder="Describe what you're looking for..."
      />
    </form>
  );
}
```

#### Badges and Labels

```typescript
// ✅ GOOD: Using existing Badge component
import { Badge } from "@/components/ui/badge";

function StatusIndicator({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {status}
    </Badge>
  );
}

// ❌ BAD: Creating inline styled badge
function StatusIndicator({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "active"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      )}
    >
      {status}
    </span>
  );
}
```

#### Dialogs and Modals

```typescript
// ✅ GOOD: Using existing Dialog components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function ConfirmDialog({ open, onClose, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p>This action cannot be undone.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ❌ BAD: Creating inline styled modal
function ConfirmDialog({ open, onClose, onConfirm }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80">
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold">Are you sure?</h2>
        <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 border rounded-md" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 bg-destructive text-white rounded-md" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
```

### What Counts as "Inline Styling"

The following are **violations** when used outside `src/components/ui/`:

| Violation | Example | Why It's Wrong |
|-----------|---------|----------------|
| Styled native elements | `<button className="bg-primary...">` | Use `<Button>` |
| Styled divs as cards | `<div className="rounded-lg border...">` | Use `<Card>` |
| Styled divs as badges | `<span className="rounded-full px-2...">` | Use `<Badge>` |
| Styled inputs | `<input className="border rounded...">` | Use `<Input>` |
| Custom modals | `<div className="fixed inset-0...">` | Use `<Dialog>` |
| Styled links as buttons | `<a className="bg-primary...">` | Use `<Button asChild><Link>` |
| Any `style={{}}` prop | `<div style={{ color: 'red' }}>` | Use Tailwind or CSS vars |

### What IS Allowed Outside `ui/`

| Allowed | Example | Why |
|---------|---------|-----|
| Layout classes | `className="flex gap-4"` | Structural, not styled primitive |
| Spacing classes | `className="mt-4 px-6"` | Positional, not styled primitive |
| Conditional visibility | `className={cn(isVisible && "hidden")}` | State, not styled primitive |
| Grid/flex containers | `className="grid grid-cols-2"` | Layout, not styled primitive |
| Prose/typography wrappers | `className="prose dark:prose-invert"` | Content styling, uses theme |

```typescript
// ✅ GOOD: Layout and spacing in feature component
function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r">
        <AppSidebar />
      </aside>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

// ✅ GOOD: Conditional classes for state
function MessageItem({ isSelected }: { isSelected: boolean }) {
  return (
    <Card className={cn(isSelected && "ring-2 ring-primary")}>
      {/* Using Card, just adding state-based ring */}
    </Card>
  );
}
```

### When You Need a New UI Component

If no existing component works, create it in `ui/`:

```typescript
// 1. Check existing components first
// ui/button.tsx - has variants for default, destructive, outline, secondary, ghost, link
// ui/card.tsx - has Card, CardHeader, CardContent, CardFooter
// ui/badge.tsx - has variants for default, secondary, destructive, outline
// ... etc

// 2. If nothing fits, create NEW component in ui/
// src/components/ui/status-dot.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDotVariants = cva(
  "inline-block rounded-full",
  {
    variants: {
      status: {
        online: "bg-green-500",
        offline: "bg-gray-400",
        busy: "bg-yellow-500",
      },
      size: {
        sm: "h-2 w-2",
        default: "h-3 w-3",
        lg: "h-4 w-4",
      },
    },
    defaultVariants: {
      status: "offline",
      size: "default",
    },
  }
);

function StatusDot({
  className,
  status,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusDotVariants>) {
  return (
    <span
      data-slot="status-dot"
      className={cn(statusDotVariants({ status, size }), className)}
      {...props}
    />
  );
}

export { StatusDot, statusDotVariants };

// 3. Then use it in feature components
import { StatusDot } from "@/components/ui/status-dot";

function UserListItem({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={user.status} />
      <span>{user.name}</span>
    </div>
  );
}
```

### Available UI Components Reference

Before creating ANY styled element, check this list:

| Component | File | Variants | Use For |
|-----------|------|----------|---------|
| `Button` | `ui/button.tsx` | variant, size | All clickable actions |
| `Card` | `ui/card.tsx` | - | Contained content sections |
| `Input` | `ui/input.tsx` | - | Text inputs |
| `Textarea` | `ui/textarea.tsx` | - | Multi-line text |
| `Badge` | `ui/badge.tsx` | variant | Labels, counts, statuses |
| `Alert` | `ui/alert.tsx` | variant | Notices, warnings |
| `Dialog` | `ui/dialog.tsx` | - | Modals, confirmations |
| `DropdownMenu` | `ui/dropdown-menu.tsx` | - | Context menus |
| `Tooltip` | `ui/tooltip.tsx` | - | Hover information |
| `Label` | `ui/label.tsx` | - | Form labels |
| `Separator` | `ui/separator.tsx` | - | Visual dividers |
| `Skeleton` | `ui/skeleton.tsx` | - | Loading placeholders |
| `Sheet` | `ui/sheet.tsx` | side | Slide-out panels |
| `Tabs` | `ui/tabs.tsx` | - | Tabbed content |
| `Select` | `ui/select.tsx` | - | Dropdown selection |
| `Popover` | `ui/popover.tsx` | - | Floating content |
| `Command` | `ui/command.tsx` | - | Command palettes |
| `Sidebar` | `ui/sidebar.tsx` | - | App navigation |
| `Avatar` | `ui/avatar.tsx` | - | User images |
| `ScrollArea` | `ui/scroll-area.tsx` | - | Custom scrollbars |
| `Switch` | `ui/switch.tsx` | - | Toggle switches |
| `Collapsible` | `ui/collapsible.tsx` | - | Expandable sections |
| `Breadcrumb` | `ui/breadcrumb.tsx` | - | Navigation trails |

---

## 4. Component Patterns

### 4.1 UI Component Template (Standard Pattern)

All UI primitives MUST follow this structure:

```typescript
// src/components/ui/example.tsx

// 1. Imports - external packages first, then internal
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

// 2. CVA variants (if component has variants)
const exampleVariants = cva(
  "base-classes-applied-to-all-variants",
  {
    variants: {
      variant: {
        default: "default-variant-classes",
        secondary: "secondary-variant-classes",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// 3. Component definition - function component, NOT forwardRef
function Example({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof exampleVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="example"
      className={cn(exampleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// 4. Exports - named exports only, include variants if defined
export { Example, exampleVariants };
```

### 4.2 Good vs Bad Examples

#### Component Definition

```typescript
// ✅ GOOD: Function component with ComponentProps
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// ❌ BAD: forwardRef (deprecated in React 19)
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button ref={ref} className={cn("...", className)} {...props} />
));
Button.displayName = "Button";

// ❌ BAD: Arrow function component
const Button = ({ className, ...props }: ButtonProps) => {
  return <button className={cn("...", className)} {...props} />;
};

// ❌ BAD: Default export
export default function Button() { ... }
```

#### data-slot Attribute

```typescript
// ✅ GOOD: data-slot on root element
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("...", className)}
      {...props}
    />
  );
}

// ✅ GOOD: data-slot on compound components with consistent naming
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("...", className)}
      {...props}
    />
  );
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Content
      data-slot="dialog-content"
      className={cn("...", className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  );
}

// ❌ BAD: Missing data-slot
function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("...", className)} {...props} />;
}

// ❌ BAD: Inconsistent naming convention
function SidebarTrigger({ ...props }) {
  return <button data-sidebar="trigger" {...props} />;  // Should be data-slot="sidebar-trigger"
}
```

#### displayName

```typescript
// ✅ GOOD: No displayName needed for function components
function Button({ ...props }: ButtonProps) {
  return <button {...props} />;
}

// ❌ BAD: displayName assignment (unnecessary)
function Button({ ...props }: ButtonProps) {
  return <button {...props} />;
}
Button.displayName = "Button";

// ❌ BAD: displayName with forwardRef (entire pattern is deprecated)
const Button = React.forwardRef<...>(...);
Button.displayName = "Button";
```

---

## 5. CVA (Class Variance Authority)

### 5.1 When to Use CVA

| Scenario | Use CVA? | Reasoning |
|----------|----------|-----------|
| Component has 2+ variant dimensions | ✅ Yes | Type-safe variants |
| Component will be reused 3+ times | ✅ Yes | Maintainability |
| Single conditional class | ❌ No | Use `cn()` |
| Static styling, no variants | ❌ No | Plain Tailwind |
| One-off component | ❌ No | Use `cn()` |

### 5.2 CVA Structure Pattern

```typescript
// ✅ GOOD: Complete CVA definition
const buttonVariants = cva(
  // Base classes - applied to ALL variants
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      // Visual variant
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Size variant
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    // ALWAYS define defaults
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// ❌ BAD: Missing defaultVariants
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", secondary: "..." },
  },
  // Missing defaultVariants!
});

// ❌ BAD: Variants without clear naming
const buttonVariants = cva("base-classes", {
  variants: {
    v: { a: "...", b: "..." },  // Cryptic names
    s: { 1: "...", 2: "..." },  // Numeric keys
  },
});
```

### 5.3 Standard Variant Names

Use these conventional names for consistency:

**Visual variants** (`variant`):
- `default` - Primary action
- `secondary` - Alternative primary
- `destructive` - Dangerous actions
- `outline` - Bordered, secondary emphasis
- `ghost` - Minimal, hover-only background
- `link` - Text-only, styled as hyperlink

**Size variants** (`size`):
- `sm` - Compact
- `default` - Standard
- `lg` - Large/prominent
- `icon` - Square, icon-only

### 5.4 Exporting Variants

```typescript
// ✅ GOOD: Export both component AND variants
export { Button, buttonVariants };

// Usage in other files - apply button styles to a Link
import { buttonVariants } from "@/components/ui/button";

<Link className={buttonVariants({ variant: "outline" })}>
  Click here
</Link>

// ❌ BAD: Only exporting component
export { Button };
// Now other components can't reuse the button styles
```

---

## 6. Radix UI Integration

### 6.1 Wrapping Radix Primitives

```typescript
// ✅ GOOD: Proper Radix primitive wrapper
import * as DialogPrimitive from "@radix-ui/react-dialog";

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        className,
      )}
      {...props}
    />
  );
}

// ❌ BAD: Not spreading props (breaks Radix functionality)
function DialogOverlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      // Missing {...props} - ARIA attributes won't be passed through!
    />
  );
}

// ❌ BAD: Custom element breaking accessibility
function DialogTrigger({ children }: { children: React.ReactNode }) {
  return (
    <div onClick={handleClick}>  {/* div is not focusable! */}
      {children}
    </div>
  );
}
```

### 6.2 Direct Re-exports vs Wrappers

```typescript
// ✅ GOOD: Re-export primitives that need no customization
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

// ✅ GOOD: Wrap primitives that need styling
function DialogContent({ className, children, ...props }: ...) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn("fixed left-1/2 top-1/2 ...", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
```

### 6.3 The asChild Pattern

```typescript
// ✅ GOOD: Implementing asChild for polymorphic components
import { Slot } from "@radix-ui/react-slot";

function Button({
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" {...props} />;
}

// Usage - renders as <a> with button styles
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// ❌ BAD: Wrapping instead of using asChild
function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href}>
      <Button>{children}</Button>  {/* Extra DOM nesting! */}
    </a>
  );
}
```

---

## 7. Prop Typing

### 7.1 Use Interface Extends (Not Type Intersections)

```typescript
// ✅ GOOD: Interface extends (better TypeScript performance)
interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// ✅ ACCEPTABLE: Inline intersection for simple cases
function Button({
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  // ...
}

// ❌ BAD: Type alias with intersection (slower TypeScript)
type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };
```

### 7.2 ComponentProps Patterns

```typescript
// ✅ GOOD: For native HTML elements
React.ComponentProps<"button">
React.ComponentProps<"input">
React.ComponentProps<"div">

// ✅ GOOD: For Radix primitives
React.ComponentProps<typeof DialogPrimitive.Content>
React.ComponentProps<typeof DropdownMenuPrimitive.Item>

// ✅ GOOD: For custom components
React.ComponentProps<typeof Button>
React.ComponentProps<typeof Input>

// ❌ BAD: Using HTMLAttributes (less complete)
React.HTMLAttributes<HTMLButtonElement>  // Missing ref, doesn't include all button props
React.ButtonHTMLAttributes<HTMLButtonElement>  // Better but still not as complete as ComponentProps
```

### 7.3 Extending Props with Custom Properties

```typescript
// ✅ GOOD: Adding custom props with interface
interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex cursor-default select-none items-center",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

// ❌ BAD: Manually defining all HTML props
interface DropdownMenuItemProps {
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  inset?: boolean;
  // Missing dozens of other valid props!
}
```

---

## 8. Styling Patterns

### 8.1 cn() Usage

```typescript
// ✅ GOOD: Base classes + className override
className={cn("base-classes", className)}

// ✅ GOOD: Conditional classes with &&
className={cn(
  "base-classes",
  isActive && "active-classes",
  disabled && "disabled-classes",
  className,
)}

// ✅ GOOD: CVA variants + className
className={cn(buttonVariants({ variant, size }), className)}

// ✅ GOOD: Multiple conditionals for complex styling
className={cn(
  "base-classes",
  side === "left" && "left-side-classes",
  side === "right" && "right-side-classes",
  className,
)}

// ❌ BAD: String concatenation (doesn't handle conflicts)
className={`base-classes ${className}`}

// ❌ BAD: className before base classes (can't override)
className={cn(className, "base-classes")}

// ❌ BAD: Ternary with empty string
className={cn(isActive ? "active" : "", "base")}
// Should be:
className={cn(isActive && "active", "base")}
```

### 8.2 Tailwind Class Organization

```typescript
// ✅ GOOD: Logical grouping in cn()
className={cn(
  // Layout
  "flex items-center justify-center",
  // Sizing
  "h-9 px-4 py-2",
  // Typography
  "text-sm font-medium",
  // Colors
  "bg-primary text-primary-foreground",
  // States
  "hover:bg-primary/90 focus-visible:ring-2",
  // Disabled
  "disabled:pointer-events-none disabled:opacity-50",
  // Override
  className,
)}

// ❌ BAD: Random ordering
className={cn(
  "font-medium disabled:opacity-50 flex h-9 hover:bg-primary/90 text-sm items-center bg-primary px-4",
  className,
)}
```

### 8.3 Avoid Inline Styles

```typescript
// ✅ GOOD: Use Tailwind utilities
className="transition-transform duration-300 ease-out"

// ✅ GOOD: Use CSS custom properties for dynamic values
style={{ "--sidebar-width": width } as React.CSSProperties}
className="w-[var(--sidebar-width)]"

// ❌ BAD: Inline style for static values
style={{ animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}

// ❌ BAD: Hardcoded colors
className="bg-[#2A2820] hover:bg-[#3A3830]"
// Should use CSS variables or Tailwind theme colors:
className="bg-sidebar-accent hover:bg-sidebar-accent/80"
```

### 8.4 No Custom CSS Classes

```typescript
// ✅ GOOD: Use Tailwind utilities
className="animate-in fade-in-0 slide-in-from-bottom-4"

// ❌ BAD: Custom class names (requires separate CSS file)
className="animate-fade-slide-up"
className="btn-warm"
className="input-elevated"
className="folder-badge"

// If custom animations needed, add to tailwind.config.ts:
// animation: {
//   "fade-slide-up": "fadeSlideUp 0.3s ease-out",
// }
```

---

## 9. Feature Components

### 9.1 Feature vs UI Components

| Aspect | UI Component (`ui/`) | Feature Component (`chat/`, `nav/`) |
|--------|---------------------|-------------------------------------|
| Business logic | None | Minimal - delegate to hooks |
| Store access | None | Via hooks only |
| Database calls | Never | Via hooks only |
| Complexity | Low (< 100 lines ideal) | Medium (< 300 lines ideal) |
| Reusability | High | Low (feature-specific) |
| Styling | Full Tailwind/CVA | **Compose UI only, no inline styles** |

### 9.2 Feature Component Pattern

```typescript
// ✅ GOOD: Feature component with hook delegation, composing UI primitives
import { useChatStream } from "@/client/hooks/use-chat-stream";
import { useChatStore } from "@/client/stores/chat-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  chatId: string;
  onSubmit: (message: string) => void;
}

export function ChatInput({ chatId, onSubmit }: ChatInputProps) {
  // State from store (single responsibility)
  const input = useChatStore((state) => state.input);
  const setInput = useChatStore((state) => state.setInput);

  // Event handler (simple, delegates to prop)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input);
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
      />
      <Button type="submit" disabled={!input.trim()}>
        Send
      </Button>
    </form>
  );
}

// ❌ BAD: Feature component with inline styling
export function ChatInput({ chatId }: { chatId: string }) {
  return (
    <form className="flex gap-2">
      {/* Creating styled input instead of using <Input> component */}
      <input
        className="h-9 w-full rounded-md border border-input bg-transparent px-3"
        placeholder="Type a message..."
      />
      {/* Creating styled button instead of using <Button> component */}
      <button
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground"
        type="submit"
      >
        Send
      </button>
    </form>
  );
}
```

### 9.3 When to Extract Logic

Extract to a custom hook when:
- Component has 5+ state variables
- Component has async operations
- Logic is reused across components
- Component exceeds 200 lines

```typescript
// ✅ GOOD: Extract complex logic to hook
// src/client/hooks/use-chat-input.ts
export function useChatInput(chatId: string) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sendMessage = useSendMessage(chatId);

  const submit = async () => {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await sendMessage(input);
    setInput("");
    setIsSubmitting(false);
  };

  return { input, setInput, isSubmitting, submit };
}

// src/components/chat/chat-input.tsx
export function ChatInput({ chatId }: { chatId: string }) {
  const { input, setInput, isSubmitting, submit } = useChatInput(chatId);

  return (
    <form onSubmit={submit}>
      <Input value={input} onChange={(e) => setInput(e.target.value)} />
      <Button disabled={isSubmitting}>Send</Button>
    </form>
  );
}
```

---

## 10. Import & Export Conventions

### 10.1 Import Order

```typescript
// 1. External packages (alphabetical within group)
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, X } from "lucide-react";
import * as React from "react";

// 2. Internal - Client domain
import { useChatStore } from "@/client/stores/chat-store";
import { useLocalChats } from "@/client/hooks/use-local-chats";

// 3. Internal - Components
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// 4. Internal - Types (type-only imports)
import type { DB_Chat } from "@/types";

// 5. Internal - Utilities
import { cn } from "@/lib/utils";
```

### 10.2 Export Conventions

```typescript
// ✅ GOOD: Named exports only
export { Button, buttonVariants };
export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle };

// ✅ GOOD: Single component files
// button.tsx
export { Button, buttonVariants };

// ❌ BAD: Default exports
export default Button;

// ❌ BAD: Re-exporting everything
export * from "./button";
```

### 10.3 Compound Component Exports

```typescript
// ✅ GOOD: All parts exported individually from single file
// dialog.tsx
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
// ... wrapped components ...

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

---

## 11. Accessibility

### 11.1 Preserve Radix Accessibility

```typescript
// ✅ GOOD: Spread all props to preserve ARIA attributes
function DialogContent({ className, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Content
      className={cn("...", className)}
      {...props}  // Includes aria-labelledby, aria-describedby, etc.
    />
  );
}

// ❌ BAD: Only accepting specific props
function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Content className={cn("...", className)}>
      {children}
    </DialogPrimitive.Content>
    // Missing all ARIA props!
  );
}
```

### 11.2 Semantic Elements

```typescript
// ✅ GOOD: Use semantic elements
<button type="button" onClick={handleClick}>Click me</button>
<a href="/path">Navigate</a>
<nav aria-label="Main navigation">...</nav>

// ❌ BAD: Div with click handler (not focusable, no keyboard support)
<div onClick={handleClick}>Click me</div>

// ❌ BAD: Button as link (confusing semantics)
<button onClick={() => navigate("/path")}>Navigate</button>
// Use asChild pattern instead:
<Button asChild>
  <Link to="/path">Navigate</Link>
</Button>
```

### 11.3 Required Accessibility Attributes

```typescript
// ✅ GOOD: Icon-only buttons have accessible labels
<Button size="icon" aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// ✅ GOOD: Or use sr-only text
<Button size="icon">
  <X className="h-4 w-4" />
  <span className="sr-only">Close dialog</span>
</Button>

// ❌ BAD: Icon-only button without accessible label
<Button size="icon">
  <X className="h-4 w-4" />
</Button>
```

---

## 12. Validation Checklist

Use this checklist when reviewing components:

### UI Component (`src/components/ui/`) Checklist

- [ ] Uses function component (NOT `React.forwardRef`)
- [ ] No `displayName` assignment
- [ ] Has `data-slot` attribute on root element
- [ ] Uses `React.ComponentProps<"element">` or `React.ComponentProps<typeof Primitive>` for props
- [ ] Spreads `{...props}` to root element
- [ ] Uses `cn()` for className merging
- [ ] className is last parameter in `cn()` (allows overrides)
- [ ] Named export only (no default export)
- [ ] If has variants: uses CVA with `defaultVariants`
- [ ] If has variants: exports both component and variants
- [ ] If wraps Radix: uses consistent `data-slot` naming (e.g., `dialog-content`)
- [ ] If polymorphic: implements `asChild` with `Slot`
- [ ] No business logic or state management
- [ ] No hardcoded hex colors (use CSS variables)
- [ ] No inline styles for static values
- [ ] No custom CSS class names

### Feature Component (`src/components/chat/`, `src/components/nav/`) Checklist

- [ ] Uses function component
- [ ] Named export only
- [ ] Props interface defined
- [ ] Complex logic extracted to hooks
- [ ] Store access via hooks (not direct)
- [ ] No direct database calls (use hooks)
- [ ] Component under 300 lines (ideally under 200)
- [ ] **Composes UI primitives only (no inline styled elements)**
- [ ] **No className with visual styling on native elements**
- [ ] **No style={{}} props**
- [ ] Event handlers are simple (delegate to hooks/props)

### Inline Styling Violations to Flag

| Violation | Severity | Example |
|-----------|----------|---------|
| Styled `<button>` outside ui/ | **Error** | `<button className="bg-primary...">` |
| Styled `<input>` outside ui/ | **Error** | `<input className="border rounded...">` |
| Styled `<div>` as card | **Error** | `<div className="rounded-lg border shadow...">` |
| Styled `<span>` as badge | **Error** | `<span className="rounded-full px-2...">` |
| Custom modal/dialog | **Error** | `<div className="fixed inset-0...">` |
| Any `style={{}}` prop | **Warning** | `<div style={{ color: 'red' }}>` |
| Hardcoded hex colors | **Warning** | `className="bg-[#2A2820]"` |

### Common Issues to Flag

| Issue | Severity | Auto-fixable |
|-------|----------|--------------|
| Missing `data-slot` | Warning | Yes |
| Using `forwardRef` | Warning | Yes |
| Using `displayName` | Warning | Yes |
| Default export | Error | Yes |
| Missing `{...props}` spread | Error | No |
| Hardcoded hex colors | Warning | No |
| Inline styles | Warning | No |
| Business logic in UI component | Error | No |
| Component > 300 lines | Warning | No |
| **Inline styled element outside ui/** | **Error** | No |

---

## 13. References

### Official Documentation

- [shadcn/ui Documentation](https://ui.shadcn.com/docs) - Component patterns and conventions
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - React 19 component structure
- [shadcn/ui React 19 Guide](https://ui.shadcn.com/docs/react-19) - Migration and compatibility
- [Radix UI Primitives](https://www.radix-ui.com/primitives) - Headless component library
- [Radix UI Composition Guide](https://www.radix-ui.com/primitives/docs/guides/composition) - Wrapping patterns
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) - A11y features
- [CVA Documentation](https://cva.style/docs) - Class Variance Authority
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19) - forwardRef deprecation

### Best Practices Articles

- [The Anatomy of shadcn/ui](https://manupa.dev/blog/anatomy-of-shadcn-ui) - Technical deep dive
- [Vercel Academy - Compound Components](https://vercel.com/academy/shadcn-ui/compound-components-and-advanced-composition) - Advanced patterns
- [React TypeScript Cheatsheets](https://github.com/typescript-cheatsheets/react) - Type patterns
- [Strongly Typing React Props](https://www.totaltypescript.com/react-props-typescript) - Prop typing best practices
- [Atomic Design Methodology](https://atomicdesign.bradfrost.com/) - Component composition principles

### Related Domain Documentation

- [Client Domain Guide](./client.md) - Hooks and stores patterns
- [Types Domain Guide](./types.md) - Shared type definitions

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Initial version based on Phase 1 research | AI Agent |
| 2025-11-28 | Added Section 3: No Inline Styling Outside UI Directory | AI Agent |
