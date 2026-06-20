# KaizenFlow

KaizenFlow is a comprehensive self-management and productivity dashboard that integrates the core principles of continuous improvement (Kaizen), Getting Things Done (GTD), Time Blocking, and Spaced Repetition.

This is the codebase for **Phase 1: Scaffolding and Core Layout Shell**.

---

## 🛠️ Getting Started

### Prerequisites
Make sure you have Node.js installed (v18.0.0 or higher is recommended).
Verify your installation:
```bash
node -v
npm -v
```

### 1. Install Dependencies
Navigate to the project root directory and run:
```bash
npm install
```

### 2. Run the Development Server
Launch the local Next.js development server:
```bash
npm run dev
```

### 3. Access the Application
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 📂 Project Architecture

```text
c:\Projects\Flow\
├── src\
│   ├── app\
│   │   ├── globals.css      # Core styles, global color scheme, and typography (Outfit)
│   │   ├── layout.tsx       # Root layout injecting custom fonts & SEO metadata
│   │   └── page.tsx         # Dashboard layout rendering the 3-pane static shell
│   └── components\
│       ├── CaptureZone.tsx          # Left Pane (Inbox capture field & mock thoughts)
│       ├── TimeBlockCanvas.tsx      # Center Pane (Daily schedule timeline & Flex modes)
│       └── MicroExecutionPanel.tsx  # Right Pane (50:10 Pomodoro timer & actionable steps)
├── public\                  # Static assets (favicons, logos)
├── package.json             # Scripts & package configurations
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project documentation
```

---

## 🎨 Visual and Design System (Phase 1)
- **Three-Pane Dashboard**:
  - **Left Pane (The Capture Zone)**: Displays the inbox text field and lists raw, unprocessed thoughts.
  - **Center Pane (The Time Block Canvas)**: Hourly breakdown timeline highlighting deep-work blocks, the daily "Frog" task, and a clean toggle for weekend flex buffers.
  - **Right Pane (Micro-Execution Panel)**: Contains a mock 50:10 timer, a physical-action breakdown checklist, and an End-of-Day reflection placeholder.
- **Glassmorphism**: Cards feature visual depth using semi-transparent dark backgrounds (`bg-card-glass`), micro-fine borders (`border-border-glass`), backdrop-filters (`backdrop-blur-md`), and radial background gradients.
- **Color Accent Palette**:
  - **Accent Violet**: Universal brand tone (`var(--accent)`).
  - **Accent Frog**: High-priority tasks styled in a bright, warning red (`var(--frog)`).
  - **Accent Success**: Productive anchors and weekend flex times styled in clean emerald green (`var(--success)`).

---

## 🧪 Phase 1 Static Verification
This iteration is strictly focused on scaffold completeness, component organization, and layout fidelity.
- Complex interactive state logic (such as dragging items from the Inbox, active timer counts, or reflection submission) is disabled in this phase.
- Use the weekday selectors at the top of the **Time Block Canvas** to view the difference between a structured weekday view (e.g. Wed) and Weekend Flex mode (e.g. Sat).
