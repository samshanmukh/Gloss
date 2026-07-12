"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Focus,
  Layers3,
  List,
  Network,
  PanelRightClose,
  Search,
  Sparkles,
  StickyNote,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_CONCEPTS,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNode,
  PAPER_META,
  ReadingNote,
  graphStore,
  learnerStore,
  memoryAdapter,
  noteStore,
} from "@/lib/gloss";

type ViewMode = "graph" | "timeline" | "list";
type Filter = "all" | "mastered" | "learning" | "paper-1" | "paper-2" | "notes";

type ConceptData = {
  label: string;
  summary: string;
  sourceTitle: string;
  sourceType: "paper-1" | "paper-2" | "note";
  status: "mastered" | "learning" | "open";
  onInspect: (id: string) => void;
};

type ConceptFlowNode = Node<ConceptData, "concept">;

const BASE_POSITIONS: Record<string, { x: number; y: number }> = {
  sensor: { x: 80, y: 80 },
  "closed-loop": { x: 365, y: 225 },
  action: { x: 75, y: 390 },
  reward: { x: 360, y: -5 },
  prediction: { x: 775, y: 45 },
  "td-error": { x: 860, y: 260 },
  update: { x: 650, y: 445 },
};

const BASE_SUMMARIES: Record<string, string> = {
  sensor: "Information returned from the environment after an action.",
  "closed-loop": "A cycle where actions change the environment and feedback shapes the next action.",
  action: "The possible choices available to an agent.",
  reward: "A scalar value indicating how well the latest action performed.",
  prediction: "An estimate of future reward or value.",
  "td-error": "The gap between expected and observed outcomes.",
  update: "The rule that adjusts estimates using the TD error.",
};

const BASE_EDGES: KnowledgeEdge[] = [
  { id: "base-1", from: "sensor", to: "closed-loop", relation: "provides feedback to" },
  { id: "base-2", from: "closed-loop", to: "action", relation: "selects from" },
  { id: "base-3", from: "closed-loop", to: "reward", relation: "uses" },
  { id: "base-4", from: "prediction", to: "td-error", relation: "is compared by" },
  { id: "base-5", from: "td-error", to: "update", relation: "drives" },
  { id: "cross-paper", from: "reward", to: "td-error", relation: "grounds understanding of" },
];

function ConceptNodeCard({ id, data, selected }: NodeProps<ConceptFlowNode>) {
  return (
    <button
      className={`kg-node kg-${data.sourceType} kg-status-${data.status} ${selected ? "selected" : ""}`}
      onClick={() => data.onInspect(id)}
      aria-label={`Inspect ${data.label}`}
    >
      <Handle type="target" position={Position.Left} />
      <span className="kg-node-orbit" />
      <span className="kg-node-icon">
        {data.sourceType === "note" ? <StickyNote size={15} /> : data.sourceType === "paper-1" ? <FileText size={15} /> : <BrainCircuit size={15} />}
      </span>
      <span className="kg-node-copy">
        <strong>{data.label}</strong>
        <small>{data.sourceType === "note" ? "Your note" : data.sourceType === "paper-1" ? "Paper 1" : "Paper 2"}</small>
      </span>
      {data.status === "mastered" && <i className="kg-mastered-badge"><Check size={11} /></i>}
      <Handle type="source" position={Position.Right} />
    </button>
  );
}

const nodeTypes = { concept: ConceptNodeCard };

function sourceColor(source: ConceptData["sourceType"]) {
  if (source === "paper-1") return "#58a6ff";
  if (source === "paper-2") return "#9a7cff";
  return "#efaa61";
}

export default function KnowledgeWorkspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [allGraph, setAllGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] });
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [learnerName, setLearnerName] = useState("Learner");
  const [view, setView] = useState<ViewMode>("graph");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const flowRef = useRef<ReactFlowInstance<ConceptFlowNode, Edge> | null>(null);
  const learnerIdRef = useRef("sam");

  const inspect = useCallback((id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const learner = learnerStore.read();
      learnerIdRef.current = learner.id;
      setLearnerName(learner.name);
      const learned = memoryAdapter.read(learner.id).mastered;
      const dynamic = graphStore.read(learner.id);
      const savedNotes = noteStore.read(learner.id);
      const savedLayout = JSON.parse(window.localStorage.getItem(`gloss-graph-layout-${learner.id}`) || "{}") as Record<string, { x: number; y: number }>;
      const baseNodes: KnowledgeNode[] = BASE_CONCEPTS.map((concept) => ({
        id: concept.id,
        label: concept.label.replace("\n", " "),
        summary: BASE_SUMMARIES[concept.id],
        sourceTitle: PAPER_META[concept.paper].title,
        sourceType: "paper",
        status:
          concept.id === "reward" && learned.includes("reward_signal")
            ? "mastered"
            : concept.id === "td-error" && learned.includes("td_error")
              ? "mastered"
              : concept.status,
        x: BASE_POSITIONS[concept.id].x,
        y: BASE_POSITIONS[concept.id].y,
      }));
      const merged = { nodes: [...baseNodes, ...dynamic.nodes], edges: [...BASE_EDGES, ...dynamic.edges] };
      setAllGraph(merged);
      setNotes(savedNotes);
      setNodes(
        merged.nodes.map((node, index) => {
          const sourceType: ConceptData["sourceType"] =
            node.sourceType === "note"
              ? "note"
              : BASE_CONCEPTS.find((item) => item.id === node.id)?.paper === "td"
                ? "paper-2"
                : "paper-1";
          const fallback =
            node.sourceType === "note"
              ? { x: 300 + (index % 4) * 220, y: 650 + Math.floor(index / 4) * 180 }
              : { x: node.x, y: node.y };
          return {
            id: node.id,
            type: "concept",
            position: savedLayout[node.id] ?? fallback,
            data: {
              label: node.label,
              summary: node.summary,
              sourceTitle: node.sourceTitle,
              sourceType,
              status: node.status,
              onInspect: inspect,
            },
          };
        }),
      );
      setEdges(
        merged.edges.map((edge) => ({
          id: edge.id,
          source: edge.from,
          target: edge.to,
          label: edge.relation,
          type: "bezier",
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: edge.id === "cross-paper" ? "#a78bfa" : "#7180a4" },
          style: {
            stroke: edge.id === "cross-paper" ? "#a78bfa" : edge.sourceNoteId ? "#d59655" : "#7180a4",
            strokeWidth: edge.id === "cross-paper" ? 2.2 : 1.4,
          },
          labelStyle: { fill: "#9ca6c0", fontSize: 9, fontWeight: 600 },
          labelBgStyle: { fill: "#11182c", fillOpacity: 0.9 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 5,
        })),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inspect, setEdges, setNodes]);

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return nodes.map((node) => {
      const matchesQuery =
        !normalized ||
        node.data.label.toLowerCase().includes(normalized) ||
        node.data.summary.toLowerCase().includes(normalized) ||
        node.data.sourceTitle.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === "all" ||
        filter === node.data.status ||
        filter === node.data.sourceType;
      return { ...node, hidden: !matchesQuery || !matchesFilter };
    });
  }, [filter, nodes, query]);

  const visibleIds = useMemo(() => new Set(visibleNodes.filter((node) => !node.hidden).map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
        animated: animate,
      })),
    [animate, edges, visibleIds],
  );

  const selectedNode = nodes.find((node) => node.id === selectedId);
  const relationships = allGraph.edges.filter((edge) => edge.from === selectedId || edge.to === selectedId);
  const masteredCount = nodes.filter((node) => node.data.status === "mastered").length;
  const noteCount = nodes.filter((node) => node.data.sourceType === "note").length;

  function persistLayout() {
    const layout = Object.fromEntries(nodes.map((node) => [node.id, node.position]));
    window.localStorage.setItem(`gloss-graph-layout-${learnerIdRef.current}`, JSON.stringify(layout));
  }

  function focusNode(id: string) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    setSelectedId(id);
    setInspectorOpen(true);
    setView("graph");
    window.setTimeout(() => flowRef.current?.setCenter(node.position.x + 90, node.position.y + 45, { zoom: 1.35, duration: 700 }), 40);
  }

  return (
    <main className={`knowledge-workspace ${animate ? "is-animated" : ""}`}>
      <header className="kg-topbar">
        <div className="kg-topbar-left">
          <Link className="kg-logo" href="/" aria-label="Gloss landing page"><Sparkles size={17} /></Link>
          <div><strong>Knowledge Studio</strong><span>{learnerName}’s connected understanding</span></div>
        </div>
        <nav className="kg-view-tabs">
          <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}><Network size={14} /> Graph</button>
          <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><Clock3 size={14} /> Timeline</button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={14} /> List</button>
        </nav>
        <div className="kg-topbar-actions">
          <button className={animate ? "active" : ""} onClick={() => setAnimate((value) => !value)}><WandSparkles size={14} /> Motion</button>
          <button onClick={() => setHelpOpen((value) => !value)} aria-label="Graph help"><CircleHelp size={15} /></button>
          <Link href="/reader"><ArrowLeft size={14} /> Back to reader</Link>
        </div>
      </header>

      <section className="kg-shell">
        <aside className="kg-sidebar">
          <div className="kg-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your knowledge" />{query && <button onClick={() => setQuery("")}><X size={13} /></button>}</div>
          <div className="kg-stats">
            <article><strong>{nodes.length}</strong><span>Concepts</span></article>
            <article><strong>{edges.length}</strong><span>Connections</span></article>
            <article><strong>{masteredCount}</strong><span>Mastered</span></article>
          </div>
          <p className="kg-side-label">Filter graph</p>
          <div className="kg-filters">
            {([
              ["all", "Everything", Layers3],
              ["mastered", "Mastered", Check],
              ["learning", "Learning", Sparkles],
              ["paper-1", "Paper 1", FileText],
              ["paper-2", "Paper 2", BrainCircuit],
              ["notes", "Your notes", StickyNote],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}><Icon size={14} /><span>{label}</span>{id === "notes" && <i>{noteCount}</i>}</button>
            ))}
          </div>
          <div className="kg-legend">
            <p className="kg-side-label">Sources</p>
            <span><i className="one" /> Embodied Neurocomputation</span>
            <span><i className="two" /> Temporal-Difference Learning</span>
            <span><i className="notes" /> Learner notes</span>
          </div>
          <div className="kg-memory-status"><BrainCircuit size={15} /><div><strong>EverOS connected</strong><span>Graph cached per learner</span></div><i /></div>
        </aside>

        <div className="kg-stage">
          {helpOpen && (
            <div className="kg-help-popover">
              <button onClick={() => setHelpOpen(false)}><X size={13} /></button>
              <strong>Navigate your knowledge</strong>
              <p>Drag concepts to reorganize them. Scroll to zoom, drag the canvas to pan, or use the mini-map. Click a node to inspect its source and relationships.</p>
            </div>
          )}

          {view === "graph" && (
            <div className="kg-flow-wrap">
              <div className="kg-aurora a" /><div className="kg-aurora b" />
              <ReactFlow<ConceptFlowNode, Edge>
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={persistLayout}
                onInit={(instance) => { flowRef.current = instance; window.setTimeout(() => instance.fitView({ padding: 0.2, duration: 900 }), 120); }}
                onPaneClick={() => setSelectedId(null)}
                fitView
                minZoom={0.25}
                maxZoom={2.2}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={25} size={1.2} color="#25304d" />
                <MiniMap
                  nodeColor={(node) => sourceColor((node.data as ConceptData).sourceType)}
                  nodeStrokeColor="#0b1020"
                  maskColor="rgba(7, 11, 24, .72)"
                  pannable
                  zoomable
                  position="bottom-left"
                />
                <Controls showInteractive={false} position="bottom-right" />
              </ReactFlow>
              <div className="kg-canvas-caption"><span><i /> Drag to pan</span><span>Scroll to zoom</span><span>Click a node to inspect</span></div>
            </div>
          )}

          {view === "timeline" && (
            <div className="kg-alt-view">
              <div className="kg-alt-heading"><span>Learning timeline</span><strong>How your understanding grew</strong><p>Confirmed concepts and notes, ordered as a learning story.</p></div>
              <div className="kg-big-timeline">
                <article><i className="paper-one" /><time>Paper 1</time><div><strong>Embodied Neurocomputation</strong><p>Sensory feedback, action space, closed-loop learning, and reward signals form the foundation.</p></div></article>
                <article><i className="paper-two" /><time>Paper 2</time><div><strong>Temporal-Difference Learning</strong><p>Prediction, TD error, and the update rule connect new learning to the mastered reward signal.</p></div></article>
                {notes.map((note) => <article key={note.id}><i className="note" /><time>{new Date(note.updatedAt).toLocaleDateString()}</time><div><strong>{note.sourceTitle}</strong><p>{note.content}</p></div></article>)}
              </div>
            </div>
          )}

          {view === "list" && (
            <div className="kg-alt-view">
              <div className="kg-alt-heading"><span>Concept library</span><strong>{visibleNodes.filter((node) => !node.hidden).length} connected ideas</strong><p>Search and filter, then open any concept in the graph.</p></div>
              <div className="kg-list-grid">
                {visibleNodes.filter((node) => !node.hidden).map((node) => (
                  <button key={node.id} onClick={() => focusNode(node.id)}>
                    <i style={{ background: sourceColor(node.data.sourceType) }} />
                    <span><strong>{node.data.label}</strong><small>{node.data.summary}</small></span>
                    <em className={node.data.status}>{node.data.status}</em><ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {inspectorOpen && (
          <aside className={`kg-inspector ${selectedNode ? "has-selection" : ""}`}>
            <div className="kg-inspector-head"><span><PanelRightClose size={15} /> Concept details</span><button onClick={() => setInspectorOpen(false)}><X size={14} /></button></div>
            {selectedNode ? (
              <div className="kg-inspector-content">
                <div className={`kg-inspector-icon kg-${selectedNode.data.sourceType}`}><Network size={20} /></div>
                <span className={`kg-status ${selectedNode.data.status}`}>{selectedNode.data.status}</span>
                <h2>{selectedNode.data.label}</h2>
                <p>{selectedNode.data.summary}</p>
                <div className="kg-source-card"><FileText size={15} /><span><small>Source</small><strong>{selectedNode.data.sourceTitle}</strong></span></div>
                <p className="kg-side-label">Relationships</p>
                <div className="kg-relations">
                  {relationships.length ? relationships.map((edge) => {
                    const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                    const other = nodes.find((node) => node.id === otherId);
                    return <button key={edge.id} onClick={() => focusNode(otherId)}><span>{edge.relation}</span><strong>{other?.data.label ?? otherId}</strong><ChevronRight size={13} /></button>;
                  }) : <p>No relationships mapped yet.</p>}
                </div>
                {selectedNode.data.sourceType === "note" && <div className="kg-note-origin"><StickyNote size={14} /><span>This concept was extracted from one of your saved notes using Butterbase AI.</span></div>}
              </div>
            ) : (
              <div className="kg-inspector-empty"><Focus size={27} /><strong>Select a concept</strong><p>Click any node to inspect its meaning, source, mastery state, and relationships.</p></div>
            )}
          </aside>
        )}
      </section>
    </main>
  );
}
