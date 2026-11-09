export type BoardElementType =
  | 'sticky'
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'link'
  | 'shape'
  | 'container';

export type ShapeKind = 'rectangle' | 'rounded' | 'circle' | 'card';

export interface BoardElement {
  id: string;
  type: BoardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  groupId?: string;
  title?: string;
  content?: string;
  url?: string;
  thumbnailUrl?: string;
  color?: string;
  textColor?: string;
  fontSize?: number;
  shapeKind?: ShapeKind;
  locked?: boolean;
  aspectRatio?: number;
  metadata?: {
    filename?: string;
    filesize?: number;
    mimeType?: string;
    duration?: number;
    author?: string;
    favicon?: string;
    domain?: string;
    isYoutube?: boolean;
    youtubeId?: string;
    [key: string]: any;
  };
}

export interface BoardGroup {
  id: string;
  title: string;
  color?: string;
  locked?: boolean;
}

export interface BoardConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
  arrow?: boolean;
}

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardData {
  elements: BoardElement[];
  groups: BoardGroup[];
  connections?: BoardConnection[];
  viewport: BoardViewport;
}

export interface BoardFile {
  id: string;
  projectId: number | string;
  title: string;
  data: BoardData;
  createdAt: string;
  updatedAt: string;
}

export interface SnapGuide {
  id: string;
  orientation: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
  snapType: 'edge' | 'center';
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export interface BoardShareRecord {
  id: string;
  boardId: string;
  projectId: number;
  token: string;
  createdBy?: number;
  expiresAt?: string | null;
  createdAt: string;
}
