export type DocumentStatus = "imported" | "ready" | "processing" | "translated";

export type SourceType = "pdf" | "html" | "docx" | "text";

export type DocumentCategory = {
  id: string;
  name: string;
  count: number;
};

export type Citation = {
  id: string;
  label: string;
  excerpt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  saved?: boolean;
  createdAt?: string;
};

export type Annotation = {
  id: string;
  anchor: string;
  note: string;
  createdAt?: string;
};

export type DocumentSection = {
  id: string;
  title: string;
  summary: string;
  paragraphStart: number;
  paragraphEnd: number;
};

export type ReadingReport = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
};

export type FavoriteConversation = {
  id: string;
  title: string;
  category: string;
  messages: ChatMessage[];
  excerpt?: string;
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  sourceDocumentDeleted?: boolean;
  createdAt: string;
};

export type LibraryDocument = {
  id: string;
  title: string;
  sourceType: SourceType;
  status: DocumentStatus;
  language: string;
  categoryId: string;
  updatedAt: string;
  summary: string;
  sections: DocumentSection[];
  content: string[];
  notes: Annotation[];
  conversation: ChatMessage[];
  favorites: FavoriteConversation[];
  reports: ReadingReport[];
};

export type ComparisonInsight = {
  topic: string;
  consensus: string;
  difference: string;
};

export type CompareResult = {
  documentIds: string[];
  insights: ComparisonInsight[];
};

export type CompareRecord = CompareResult & {
  id: string;
  generatedAt: string;
  documentTitles: string[];
};

export type WorkspaceData = {
  categories: DocumentCategory[];
  documents: LibraryDocument[];
  favorites: FavoriteConversation[];
  compareResult: CompareResult;
  compareHistory: CompareRecord[];
};

export type CreateDocumentInput = {
  title: string;
  sourceType: SourceType;
  categoryId: string;
  content: string;
};

export type CreateCategoryInput = {
  name: string;
};

export type CreateAnnotationInput = {
  documentId: string;
  anchor: string;
  note: string;
};

export type CreateFavoriteInput = {
  documentId: string;
  title: string;
  category?: string;
  messageIds: string[];
  excerpt?: string;
};
