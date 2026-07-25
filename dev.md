# Build a Modern AI Project Management Dashboard (Linear Inspired)

Create a pixel-perfect, ultra-modern project management web application inspired by Linear, Notion, and GitHub Projects.

## Overall Style

- Dark premium interface
- Minimalistic
- Extremely clean
- High information density
- Enterprise SaaS aesthetic
- Native desktop application feel
- Smooth rounded corners
- Soft borders
- Subtle glassmorphism only where appropriate
- No unnecessary gradients
- Focus on typography and spacing
- Inspired by:
  - Linear
  - Vercel Dashboard
  - GitHub
  - Raycast
  - Cursor IDE
  - Arc Browser

The application should feel incredibly fast and professional.

---

# Layout

Use a 3-column responsive desktop layout.

```
-------------------------------------------------------------
| Sidebar |      Main Issue View        | AI Assistant Panel |
-------------------------------------------------------------
```

Sidebar:
- Fixed width (260px)
- Scrollable
- Darker than content area
- Logo at top
- Search button
- Quick action button
- Navigation
- Workspace section
- Favorites section
- Active item highlighted

Main Content:
- Flexible width
- Scrollable independently
- Displays selected task
- Comments
- Activity
- Timeline
- Metadata

Right Panel:
- Fixed width (420px)
- AI assistant
- Sticky
- Chat style
- Context aware

---

# Color Palette

Background

Primary Background:
#0E0F12

Sidebar:
#0B0C0E

Cards:
#141518

Borders:
rgba(255,255,255,.07)

Hover:
rgba(255,255,255,.04)

Active Item:
rgba(255,255,255,.08)

Primary Text:
#F5F5F7

Secondary:
#B7BBC5

Muted:
#7D8492

Accent Yellow:
#EAB308

Success:
#22C55E

Danger:
#EF4444

Blue:
#3B82F6

Purple:
#8B5CF6

---

# Typography

Use:

Inter

Weights:

400

500

600

700

Large title:
36px

Section titles:
26px

Card titles:
20px

Normal:
15px

Small:
13px

Meta:
12px

Line height:
1.6

Letter spacing:
Slightly negative

---

# Sidebar

Top

Logo

Workspace switcher

Search icon

Quick create button

Navigation

Inbox

My Issues

Reviews

Pulse

Projects

Initiatives

Teams

Roadmap

Releases

Favorites

Pinned Issues

Pinned Projects

Pinned Agents

Recent

Settings

Bottom

User avatar

Workspace info

Notifications

---

# Main Issue Page

Top Bar

Breadcrumb

Issue number

Favorite button

Previous

Next

Share

Link

Git controls

Issue Header

Large issue title

Markdown description

Inline code styling

Labels

Tags

Assignee

Priority

Status

Due date

Created

Updated

Estimated hours

Sprint

Epic

Team

---

# Activity Timeline

Timeline style

Every event contains

Avatar

Username

Timestamp

Content

Attachments

Mentions

Status updates

System updates

Examples

Task moved

Comment

PR linked

AI generated summary

Agent update

Branch pushed

Commit linked

Deployment

Hover animation

---

# Comments

Rounded containers

Markdown

Mentions

Emoji reactions

Code blocks

Syntax highlighting

Images

Expandable threads

Replies

Edit history

---

# Right AI Assistant Panel

Looks like ChatGPT + Cursor Agent

Header

AI name

Model selector

Status indicator

Elapsed runtime

Conversation

Thinking animation

Execution logs

File modifications

Generated code summary

PR creation

Commit preview

Diff summary

Buttons

Preview

Accept

Reject

Apply Changes

Regenerate

Copy

Terminal

Bottom Input

Large prompt input

Attachment button

Voice button

Run button

Shortcuts

---

# Cards

Rounded:
14px

Padding:
24px

Border:
1px solid rgba(255,255,255,.06)

Shadow:
Very subtle

Hover:
Lift 2px

Transition:
200ms

---

# Icons

Use Lucide Icons

Consistent stroke

18-20px

No filled icons

---

# Navigation

Smooth hover

Active pill

Keyboard shortcuts

Command palette

Search modal

---

# Components

Create reusable components.

Sidebar

Navigation Item

Issue Card

Timeline Item

Comment

Avatar

Status Badge

Priority Badge

AI Message

AI Tool Card

Code Block

PR Card

Diff Viewer

Input

Dropdown

Tooltip

Popover

Context Menu

Modal

Toast

Tabs

Breadcrumb

Pagination

Search

Filter

---

# Status Badges

Todo

In Progress

Blocked

Done

Cancelled

Needs Review

Waiting

AI Working

Merged

---

# Priority

Critical

High

Medium

Low

No Priority

Use colors only as accents.

---

# Animations

Everything should animate.

Sidebar hover

Page transitions

Fade

Slide

Scale

Status changes

Loading skeletons

Typing animation

AI thinking

Expandable sections

Micro interactions

120-250ms

Use Framer Motion.

---

# AI Features

Task summarization

Generate code

Review PR

Suggest commits

Explain code

Create branch

Generate tests

Estimate task

Detect blockers

Generate documentation

AI reasoning timeline

Execution logs

Tool usage

Agent status

---

# Responsive

Desktop

Large Desktop

Tablet

Collapse sidebar

Mobile

Drawer navigation

Bottom assistant

---

# Accessibility

WCAG AA

Keyboard navigation

Focus rings

ARIA labels

Screen reader friendly

Reduced motion support

High contrast mode

---

# Technology

React

Next.js

TypeScript

TailwindCSS

shadcn/ui

Framer Motion

Lucide React

TanStack Query

React Hook Form

Zod

Radix UI

Sonner

CMDK

Recharts

---

# Design Principles

Perfect spacing

8px spacing system

Large whitespace

Minimal colors

Excellent typography

No clutter

Enterprise ready

Production quality

Modern SaaS

Desktop application quality

Feels as polished as Linear, GitHub, Vercel, and Cursor combined.

Every component should be reusable, modular, and fully responsive.

The final UI should look like a premium AI-native project management platform rather than a clone, while preserving the same clean information hierarchy and elegant interaction patterns.