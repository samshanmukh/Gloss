import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Database,
  FileSearch,
  FileText,
  Highlighter,
  Layers3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Network,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  StickyNote,
  ThumbsUp,
  Upload,
  UserRound,
  Workflow,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Real PDF reading",
    copy: "Upload any PDF and read it through a selectable PDF.js text layer with page navigation, zoom, and fullscreen.",
    tag: "Browser-native",
  },
  {
    icon: MessageSquareText,
    title: "Grounded AI tutor",
    copy: "Select a passage and ask follow-up questions. Answers stay anchored to source text and adapt to prior understanding.",
    tag: "Butterbase AI",
  },
  {
    icon: BrainCircuit,
    title: "Memory across papers",
    copy: "Confirmed concepts, questions, and learning preferences are retrieved through EverOS hybrid memory.",
    tag: "EverOS",
  },
  {
    icon: StickyNote,
    title: "Notes that become knowledge",
    copy: "Create, edit, and delete sourced notes. Every saved note is synced and transformed into graph-ready concepts.",
    tag: "AI extraction",
  },
  {
    icon: Network,
    title: "Living knowledge graph",
    copy: "Inspect nodes, traverse relationships, use Graph, Timeline, and List views, or navigate through the mini-map.",
    tag: "Interactive",
  },
  {
    icon: Search,
    title: "Search everything",
    copy: "Use ⌘K to search papers, concepts, notes, and live EverOS memory from one command palette.",
    tag: "Hybrid search",
  },
  {
    icon: UserRound,
    title: "Learner profiles",
    copy: "Memory, notes, feedback, graph data, and reading time are isolated by learner identity.",
    tag: "Personalized",
  },
  {
    icon: Clock3,
    title: "Reading goals",
    copy: "Visible-session reading time accumulates by learner and day against a configurable three-hour goal.",
    tag: "Progress",
  },
  {
    icon: ThumbsUp,
    title: "Explanation feedback",
    copy: "Rate both prepared explanations and generated answers. Feedback persists with the learner profile.",
    tag: "Adaptive",
  },
];

const stack = [
  ["Application", "Next.js 16 · React 19 · TypeScript 6", "App Router, Edge route handlers, responsive client workspace"],
  ["Documents", "PDF.js 6", "Canvas rendering, selectable text layers, local page navigation and zoom"],
  ["Inference", "Butterbase AI Gateway", "OpenAI-compatible completions using configurable Gemini Flash Lite"],
  ["Memory", "EverOS v1", "Hybrid retrieval, episodic memory, learner profiles, durable concept and note writes"],
  ["Hosting", "Butterbase Edge SSR", "Cloudflare Workers runtime, globally delivered static assets and APIs"],
  ["Private storage", "IndexedDB + localStorage", "PDF blobs remain in-browser; resilient local caches are learner-scoped"],
  ["Visualization", "React + SVG", "Inspectable knowledge nodes, sourced edges, mini-map, zoom, timeline, and list"],
];

const routes = [
  ["POST /api/chat", "Retrieves EverOS context, calls the model gateway, records the tutor exchange."],
  ["POST /api/memory", "Retrieves learner memory or confirms and flushes a mastered concept."],
  ["POST /api/notes", "Writes note upserts and deletion markers into EverOS."],
  ["POST /api/graph", "Extracts strict, source-grounded concept and relationship JSON from notes."],
];

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Landing navigation">
        <Link className="landing-brand" href="/">
          <span><Sparkles size={18} /></span>
          <strong>Gloss</strong>
        </Link>
        <div className="landing-links">
          <a href="#features">Features</a>
          <a href="#architecture">Architecture</a>
          <a href="#technical">Technical spec</a>
          <a href="#privacy">Privacy</a>
        </div>
        <Link className="nav-cta" href="/reader">Open reader <ArrowRight size={14} /></Link>
      </nav>

      <section className="landing-hero">
        <div className="hero-glow one" />
        <div className="hero-glow two" />
        <div className="hero-copy">
          <div className="hero-pill"><span /> Memory-native reading tutor</div>
          <h1>Every paper should build on <em>what you already know.</em></h1>
          <p>
            Gloss turns dense research into a personal learning system: select a passage, get a grounded explanation,
            capture your understanding, and watch knowledge connect across papers.
          </p>
          <div className="hero-actions">
            <Link className="landing-primary" href="/reader"><BookOpen size={17} /> Start reading <ArrowRight size={15} /></Link>
            <a className="landing-secondary" href="#architecture"><Workflow size={16} /> See how it works</a>
          </div>
          <div className="hero-proof">
            <span><Check size={13} /> Source-grounded answers</span>
            <span><Check size={13} /> Persistent learner memory</span>
            <span><Check size={13} /> PDFs stay private</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Gloss product concept">
          <div className="visual-bar">
            <span><i /><i /><i /></span>
            <small>Temporal-Difference Learning.pdf</small>
            <b>Gloss reader</b>
          </div>
          <div className="visual-grid">
            <div className="visual-paper">
              <span className="visual-kicker">3.2 · Temporal-difference learning</span>
              <strong>Learning to Predict by Experience</strong>
              <p>Temporal-difference learning updates estimates directly from experience.</p>
              <mark>The TD error measures how much better or worse the latest reward was than expected.</mark>
              <div className="visual-equation">V(sₜ) ← V(sₜ) + α [r + γV(sₜ₊₁) − V(sₜ)]</div>
            </div>
            <div className="visual-explain">
              <span><Sparkles size={12} /> GROUNDED EXPLANATION</span>
              <p>The TD error is the surprise: the gap between what the agent expected and what actually happened.</p>
              <div><Link2 size={13} /><small>Built on your knowledge</small><strong>Reward signal</strong></div>
            </div>
            <div className="visual-graph">
              <span className="node reward">Reward<br />signal<i>✓</i></span>
              <span className="node td">TD error</span>
              <span className="node update">Update<br />rule</span>
              <svg viewBox="0 0 180 210" aria-hidden>
                <path d="M45 65 C85 45 110 72 129 102" />
                <path d="M132 115 C130 145 103 160 76 176" />
              </svg>
              <small>Cross-paper knowledge transfer</small>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-strip" aria-label="Core integrations">
        <span>Built with</span>
        <strong>Next.js</strong><i />
        <strong>PDF.js</strong><i />
        <strong>Butterbase AI</strong><i />
        <strong>EverOS Memory</strong><i />
        <strong>Cloudflare Workers</strong>
      </section>

      <section className="landing-section problem-section">
        <div className="section-heading narrow">
          <span>THE PROBLEM</span>
          <h2>Reading tools remember pages.<br />They do not remember <em>you.</em></h2>
          <p>
            Research compounds when a new idea connects to an old one. Most PDF readers discard that context,
            forcing every explanation to start from zero. Gloss gives the learner—not the document—a durable state.
          </p>
        </div>
        <div className="problem-flow">
          <div><FileSearch size={20} /><strong>Select evidence</strong><p>Work from the exact source passage.</p></div>
          <ChevronRight size={18} />
          <div><Sparkles size={20} /><strong>Explain personally</strong><p>Reuse confirmed prior understanding.</p></div>
          <ChevronRight size={18} />
          <div><BrainCircuit size={20} /><strong>Remember it</strong><p>Persist the learning across papers.</p></div>
          <ChevronRight size={18} />
          <div><Network size={20} /><strong>Connect it</strong><p>Grow a sourced knowledge graph.</p></div>
        </div>
      </section>

      <section className="landing-section features-section" id="features">
        <div className="section-heading">
          <span>PRODUCT CAPABILITIES</span>
          <h2>A complete loop from reading to understanding.</h2>
          <p>Every feature is live in the deployed reader—not a roadmap placeholder.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div><feature.icon size={19} /></div>
              <small>{feature.tag}</small>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section product-section">
        <div className="section-heading">
          <span>LIVE PRODUCT</span>
          <h2>Explore the actual reader.</h2>
          <p>This embedded view is the same workspace running at <code>/reader</code>.</p>
        </div>
        <div className="product-frame">
          <div className="frame-top"><span><i /><i /><i /></span><p>gloss.butterbase.dev/reader</p><Link href="/reader">Open full screen <ArrowRight size={12} /></Link></div>
          <iframe src="/reader" title="Interactive Gloss reader preview" loading="lazy" />
        </div>
      </section>

      <section className="landing-section architecture-section" id="architecture">
        <div className="section-heading light">
          <span>SYSTEM ARCHITECTURE</span>
          <h2>Local-first documents. Edge intelligence. Durable memory.</h2>
          <p>Gloss separates private document rendering, grounded inference, and long-term learner state.</p>
        </div>

        <div className="architecture-map">
          <div className="arch-column">
            <span className="arch-label">Browser</span>
            <article><Upload size={17} /><div><strong>PDF.js reader</strong><p>Canvas + text layer</p></div></article>
            <article><Database size={17} /><div><strong>Private local storage</strong><p>IndexedDB PDF · local cache</p></div></article>
            <article><Network size={17} /><div><strong>React knowledge graph</strong><p>Nodes, edges, timeline, list</p></div></article>
          </div>
          <div className="arch-arrows"><span>HTTPS</span><ArrowRight /><span>JSON</span></div>
          <div className="arch-column edge">
            <span className="arch-label">Butterbase Edge SSR</span>
            <article><MessageSquareText size={17} /><div><strong>/api/chat</strong><p>Ground + personalize + answer</p></div></article>
            <article><StickyNote size={17} /><div><strong>/api/notes · /api/graph</strong><p>Persist + extract relationships</p></div></article>
            <article><BrainCircuit size={17} /><div><strong>/api/memory</strong><p>Retrieve + confirm + flush</p></div></article>
          </div>
          <div className="arch-arrows split"><span>Server-only keys</span><ArrowRight /><span>fetch</span></div>
          <div className="arch-column services">
            <span className="arch-label">Managed services</span>
            <article><Zap size={17} /><div><strong>Butterbase AI Gateway</strong><p>Gemini Flash Lite inference</p></div></article>
            <article><BrainCircuit size={17} /><div><strong>EverOS v1</strong><p>Hybrid episodic memory</p></div></article>
            <article><Layers3 size={17} /><div><strong>Cloudflare runtime</strong><p>Global edge delivery</p></div></article>
          </div>
        </div>

        <div className="flows-grid">
          <article>
            <span>01</span><div><strong>Ask about a passage</strong><p>Selection → EverOS retrieval → grounded system prompt → Butterbase model → answer → exchange written back to memory.</p></div>
          </article>
          <article>
            <span>02</span><div><strong>Save a note</strong><p>Local write → EverOS note event → strict JSON concept extraction → sourced graph nodes and edges → resilient cache.</p></div>
          </article>
          <article>
            <span>03</span><div><strong>Open another paper</strong><p>Hybrid memory search → mastered concepts merged into learner state → explanation adapts → cross-paper edge appears.</p></div>
          </article>
        </div>
      </section>

      <section className="landing-section technical-section" id="technical">
        <div className="section-heading">
          <span>TECHNICAL SPECIFICATION</span>
          <h2>The implementation, without the hand-waving.</h2>
          <p>Current production components and responsibilities.</p>
        </div>
        <div className="spec-layout">
          <div className="stack-table">
            {stack.map(([layer, technology, responsibility]) => (
              <div className="stack-row" key={layer}>
                <span>{layer}</span><strong>{technology}</strong><p>{responsibility}</p>
              </div>
            ))}
          </div>
          <aside className="api-card">
            <div><Code2 size={18} /><strong>Edge API surface</strong></div>
            {routes.map(([route, copy]) => (
              <article key={route}><code>{route}</code><p>{copy}</p></article>
            ))}
            <small>All route handlers run with <code>runtime = &quot;edge&quot;</code>.</small>
          </aside>
        </div>
      </section>

      <section className="landing-section privacy-section" id="privacy">
        <div className="privacy-copy">
          <span>PRIVACY BOUNDARY</span>
          <h2>Your document stays in your browser.</h2>
          <p>
            Uploaded PDF blobs are stored in the browser’s IndexedDB and rendered locally. Gloss sends only the
            selected passage and your explicit question or note through server routes when you request AI processing.
          </p>
          <ul>
            <li><ShieldCheck size={16} /><span><strong>No whole-PDF upload</strong>PDF files never leave the browser.</span></li>
            <li><LockKeyhole size={16} /><span><strong>Server-only credentials</strong>EverOS and Butterbase keys are never exposed to client JavaScript.</span></li>
            <li><UserRound size={16} /><span><strong>Learner-scoped state</strong>Notes, graph, feedback, progress, and memory are partitioned by learner ID.</span></li>
          </ul>
        </div>
        <div className="privacy-boundary">
          <div className="boundary-browser"><span>BROWSER</span><FileText size={28} /><strong>Full PDF</strong><small>IndexedDB · local only</small></div>
          <div className="boundary-gate"><ArrowRight size={17} /><code>selected text only</code><ArrowRight size={17} /></div>
          <div className="boundary-edge"><span>EDGE</span><ServerCog size={28} /><strong>Grounded APIs</strong><small>AI + memory calls</small></div>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <Sparkles size={22} />
          <h2>Turn your next paper into lasting knowledge.</h2>
          <p>Upload a PDF, select the difficult part, and let Gloss build from what you already understand.</p>
          <Link className="landing-primary light-button" href="/reader"><Highlighter size={17} /> Open Gloss reader <ArrowRight size={15} /></Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/"><span><Sparkles size={16} /></span><strong>Gloss</strong></Link>
        <p>Read. Understand. Remember.</p>
        <div><a href="#features">Features</a><a href="#architecture">Architecture</a><a href="https://github.com/samshanmukh/gloss" target="_blank" rel="noreferrer"><Code2 size={14} /> GitHub</a></div>
      </footer>
    </main>
  );
}
