import type {Variant} from './theme';

/**
 * The workflow itself — labels, icons and the connection graph — lives here,
 * never in JSX. Adding a version means adding an entry to WORKFLOWS.
 */

export type IconId =
  | 'magnifierDoc'
  | 'robotHead'
  | 'appleChecklist'
  | 'personSilhouette'
  | 'docCheck'
  | 'docStar'
  | 'docPen'
  | 'stackedPages'
  | 'checkCircle'
  | 'arrowUpBox'
  | 'barChart';

export type WorkflowNodeData = {
  id: string;
  label: string;
  icon: IconId;
  /** Centre of the card in plane space (before the plane's affine transform). */
  x: number;
  y: number;
};

export type WorkflowEdgeData = {
  from: string;
  to: string;
};

export type WorkflowData = {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  /** Node ids in build order; drives the appear-then-draw sequence. */
  order: string[];
};

/**
 * Both variants share the same skeleton: a stepped diagonal that zigzags up and
 * down across four-to-five columns, with exactly one node fanning out to two
 * outputs, so the pair reads as matched.
 */
export const WORKFLOWS: Record<Variant, WorkflowData> = {
  meal: {
    nodes: [
      {id: 'scanner', label: 'Fridge Scanner', icon: 'magnifierDoc', x: -1320, y: -350},
      {id: 'recipe', label: 'Recipe Generator', icon: 'docStar', x: -1320, y: 390},
      {id: 'ai', label: 'AI Model', icon: 'robotHead', x: -460, y: 20},
      {id: 'nutrition', label: 'Nutrition Calculation', icon: 'appleChecklist', x: 400, y: -325},
      {id: 'meal', label: 'Meal Suggestion', icon: 'personSilhouette', x: 1260, y: -620},
      {id: 'shopping', label: 'Shopping List Export', icon: 'docCheck', x: 1260, y: 65},
    ],
    edges: [
      {from: 'scanner', to: 'ai'},
      {from: 'recipe', to: 'ai'},
      {from: 'ai', to: 'nutrition'},
      {from: 'nutrition', to: 'meal'},
      {from: 'nutrition', to: 'shopping'},
    ],
    order: ['scanner', 'recipe', 'ai', 'nutrition', 'meal', 'shopping'],
  },
  content: {
    nodes: [
      {id: 'brief', label: 'Brief Input', icon: 'docPen', x: -1150, y: -250},
      {id: 'ai', label: 'AI Model', icon: 'robotHead', x: -570, y: 30},
      {id: 'draft', label: 'Draft Generation', icon: 'stackedPages', x: 20, y: -240},
      {id: 'review', label: 'Human Review', icon: 'checkCircle', x: 610, y: -500},
      {id: 'analytics', label: 'Analytics', icon: 'barChart', x: 610, y: 80},
      {id: 'publish', label: 'Publish', icon: 'arrowUpBox', x: 1180, y: -250},
    ],
    edges: [
      {from: 'brief', to: 'ai'},
      {from: 'ai', to: 'draft'},
      {from: 'draft', to: 'review'},
      {from: 'draft', to: 'analytics'},
      {from: 'review', to: 'publish'},
    ],
    order: ['brief', 'ai', 'draft', 'analytics', 'review', 'publish'],
  },
};

export const edgeKey = (e: WorkflowEdgeData) => `${e.from}->${e.to}`;
