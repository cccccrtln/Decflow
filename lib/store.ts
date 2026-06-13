import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  Annotation,
  ChatMessage,
  CompareRecord,
  CompareResult,
  CreateAnnotationInput,
  CreateCategoryInput,
  CreateDocumentInput,
  CreateFavoriteInput,
  DocumentCategory,
  FavoriteConversation,
  LibraryDocument,
  ReadingReport,
  WorkspaceData,
} from "@/types/docflow";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function splitContentBlocks(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : [content.trim()].filter(Boolean);
}

type StoreState = {
  categories: DocumentCategory[];
  documents: LibraryDocument[];
  favorites: FavoriteConversation[];
  compareResult: CompareResult;
  compareHistory: CompareRecord[];
};

const dataDirectory = path.join(process.cwd(), "data");
const storeFilePath = path.join(dataDirectory, "docflow-store.json");

const initialCategories: DocumentCategory[] = [
  { id: "default", name: "默认分类", count: 0 },
];

const initialState: StoreState = {
  categories: initialCategories.map((category) => ({ ...category })),
  documents: [],
  favorites: [],
  compareResult: {
    documentIds: [],
    insights: [],
  },
  compareHistory: [],
};

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    citations: message.citations?.map((citation) => ({ ...citation })),
  };
}

function cloneFavorite(favorite: FavoriteConversation): FavoriteConversation {
  return {
    ...favorite,
    messages: favorite.messages.map(cloneMessage),
  };
}

function cloneDocument(document: LibraryDocument): LibraryDocument {
  return {
    ...document,
    sections: document.sections.map((section) => ({ ...section })),
    content: [...document.content],
    notes: document.notes.map((note) => ({ ...note })),
    conversation: document.conversation.map(cloneMessage),
    favorites: document.favorites.map(cloneFavorite),
    reports: document.reports.map((report) => ({ ...report })),
  };
}

function cloneState(state: StoreState): StoreState {
  return {
    categories: state.categories.map((category) => ({ ...category })),
    documents: state.documents.map(cloneDocument),
    favorites: state.favorites.map(cloneFavorite),
    compareResult: {
      documentIds: [...state.compareResult.documentIds],
      insights: state.compareResult.insights.map((insight) => ({ ...insight })),
    },
    compareHistory: state.compareHistory.map((record) => ({
      ...record,
      documentIds: [...record.documentIds],
      documentTitles: [...record.documentTitles],
      insights: record.insights.map((insight) => ({ ...insight })),
    })),
  };
}

function ensureDataDirectory() {
  if (!existsSync(dataDirectory)) {
    mkdirSync(dataDirectory, { recursive: true });
  }
}

function persistState(state: StoreState) {
  ensureDataDirectory();
  writeFileSync(storeFilePath, JSON.stringify(state, null, 2), "utf8");
}

function recalculateCategoryCounts(state: StoreState) {
  state.categories = state.categories.map((category) => ({
    ...category,
    count: state.documents.filter((document) => document.categoryId === category.id).length,
  }));
}

function normalizeState(rawState: StoreState): StoreState {
  const state = cloneState(rawState);
  state.documents = state.documents.map((document) => ({
    ...document,
    sections: document.sections.map((section, index) => ({
      id: section.id,
      title: section.title,
      summary: section.summary,
      paragraphStart: section.paragraphStart ?? index,
      paragraphEnd: section.paragraphEnd ?? (section.paragraphStart ?? index),
    })),
  }));

  if (state.categories.length === 0) {
    state.categories = initialCategories.map((category) => ({ ...category }));
  }

  recalculateCategoryCounts(state);
  return state;
}

function readState(): StoreState {
  if (!existsSync(storeFilePath)) {
    const state = cloneState(initialState);
    recalculateCategoryCounts(state);
    persistState(state);
    return state;
  }

  try {
    const raw = JSON.parse(readFileSync(storeFilePath, "utf8")) as StoreState;
    return normalizeState(raw);
  } catch {
    const fallbackState = cloneState(initialState);
    recalculateCategoryCounts(fallbackState);
    persistState(fallbackState);
    return fallbackState;
  }
}

function withState<T>(updater: (state: StoreState) => T): T {
  const state = readState();
  const result = updater(state);
  recalculateCategoryCounts(state);
  persistState(state);
  return result;
}

export function listWorkspace(): WorkspaceData {
  const state = readState();
  recalculateCategoryCounts(state);
  return cloneState(state);
}

export function getDocument(documentId: string) {
  const state = readState();
  return state.documents.find((document) => document.id === documentId) ?? null;
}

export function createCategory(input: CreateCategoryInput) {
  return withState((state) => {
    const category: DocumentCategory = {
      id: makeId("category"),
      name: input.name.trim(),
      count: 0,
    };

    state.categories.unshift(category);
    return { ...category };
  });
}

export function createDocument(input: CreateDocumentInput) {
  return withState((state) => {
    const normalizedTitle = input.title.trim();
    const hasDuplicateTitle = state.documents.some(
      (document) => document.title.trim().toLowerCase() === normalizedTitle.toLowerCase()
    );

    if (hasDuplicateTitle) {
      throw new Error("标题重复");
    }

    const contentBlocks = splitContentBlocks(input.content);
    const categoryId =
      state.categories.find((category) => category.id === input.categoryId)?.id ?? state.categories[0]?.id ?? "default";

    const document: LibraryDocument = {
      id: makeId("document"),
      title: normalizedTitle,
      sourceType: input.sourceType,
      status: "imported",
      language: "待检测",
      categoryId,
      updatedAt: now().slice(0, 10),
      summary: "",
      sections: [],
      content: contentBlocks,
      notes: [],
      conversation: [],
      favorites: [],
      reports: [],
    };

    state.documents.unshift(document);
    return cloneDocument(document);
  });
}

export function deleteDocument(documentId: string) {
  return withState((state) => {
    const documentIndex = state.documents.findIndex((document) => document.id === documentId);
    if (documentIndex < 0) {
      throw new Error("未找到文档。");
    }

    const [removedDocument] = state.documents.splice(documentIndex, 1);
    state.favorites = state.favorites.map((favorite) =>
      favorite.sourceDocumentId === documentId
        ? {
            ...favorite,
            sourceDocumentDeleted: true,
          }
        : favorite
    );

    state.compareResult = {
      documentIds: state.compareResult.documentIds.filter((id) => id !== documentId),
      insights:
        state.compareResult.documentIds.filter((id) => id !== documentId).length >= 2
          ? state.compareResult.insights
          : [],
    };

    state.compareHistory = state.compareHistory.map((record) => ({
      ...record,
      documentTitles: record.documentIds.map((id, index) =>
        id === documentId
          ? `${record.documentTitles[index] ?? "未知文档"}（已删除）`
          : record.documentTitles[index] ?? "未知文档"
      ),
    }));

    return cloneDocument(removedDocument);
  });
}

export function appendConversationMessage(documentId: string, message: ChatMessage) {
  return withState((state) => {
    const document = state.documents.find((item) => item.id === documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    document.conversation.push(message);
    document.updatedAt = now().slice(0, 10);
    return cloneMessage(message);
  });
}

export function addAnnotation(input: CreateAnnotationInput): Annotation {
  return withState((state) => {
    const document = state.documents.find((item) => item.id === input.documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    const annotation: Annotation = {
      id: makeId("note"),
      anchor: input.anchor,
      note: input.note.trim(),
      createdAt: now(),
    };

    document.notes.unshift(annotation);
    return { ...annotation };
  });
}

export function createFavorite(input: CreateFavoriteInput): FavoriteConversation {
  return withState((state) => {
    const document = state.documents.find((item) => item.id === input.documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    const messages = document.conversation
      .filter((message) => input.messageIds.includes(message.id))
      .map(cloneMessage);

    const favorite: FavoriteConversation = {
      id: makeId("favorite"),
      title: input.title.trim(),
      category: input.category?.trim() || "未分类",
      messages,
      excerpt: input.excerpt?.trim() || undefined,
      sourceDocumentId: document.id,
      sourceDocumentTitle: document.title,
      sourceDocumentDeleted: false,
      createdAt: now(),
    };

    state.favorites.unshift(favorite);
    document.favorites.unshift(cloneFavorite(favorite));
    document.conversation = document.conversation.map((message) => ({
      ...message,
      saved: input.messageIds.includes(message.id) ? true : message.saved,
    }));
    return cloneFavorite(favorite);
  });
}

export function deleteFavorite(favoriteId: string) {
  return withState((state) => {
    const favoriteIndex = state.favorites.findIndex((favorite) => favorite.id === favoriteId);
    if (favoriteIndex < 0) {
      throw new Error("未找到收藏内容。");
    }

    const [removedFavorite] = state.favorites.splice(favoriteIndex, 1);
    state.documents = state.documents.map((document) => ({
      ...document,
      favorites: document.favorites.filter((favorite) => favorite.id !== favoriteId),
    }));
    return cloneFavorite(removedFavorite);
  });
}

export function deleteAnnotation(noteId: string) {
  return withState((state) => {
    for (const document of state.documents) {
      const noteIndex = document.notes.findIndex((note) => note.id === noteId);
      if (noteIndex >= 0) {
        const [removedNote] = document.notes.splice(noteIndex, 1);
        return { ...removedNote };
      }
    }

    throw new Error("未找到笔记。");
  });
}

export function deleteCategory(categoryId: string) {
  return withState((state) => {
    const categoryIndex = state.categories.findIndex((category) => category.id === categoryId);
    if (categoryIndex < 0) {
      throw new Error("未找到分类。");
    }

    const hasDocuments = state.documents.some((document) => document.categoryId === categoryId);
    if (hasDocuments) {
      throw new Error("分类下仍有文档，无法删除。");
    }

    const [removedCategory] = state.categories.splice(categoryIndex, 1);
    return { ...removedCategory };
  });
}

export function deleteCompareRecord(recordId: string) {
  return withState((state) => {
    const recordIndex = state.compareHistory.findIndex((record) => record.id === recordId);
    if (recordIndex < 0) {
      throw new Error("未找到对比记录。");
    }

    const [removedRecord] = state.compareHistory.splice(recordIndex, 1);
    return {
      ...removedRecord,
      documentIds: [...removedRecord.documentIds],
      documentTitles: [...removedRecord.documentTitles],
      insights: removedRecord.insights.map((insight) => ({ ...insight })),
    };
  });
}

export function saveReport(documentId: string, report: ReadingReport) {
  return withState((state) => {
    const document = state.documents.find((item) => item.id === documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    document.reports = [{ ...report }];
    return { ...report };
  });
}

export function updateCompareResult(compareResult: CompareResult) {
  return withState((state) => {
    state.compareResult = {
      documentIds: [...compareResult.documentIds],
      insights: compareResult.insights.map((insight) => ({ ...insight })),
    };

    if (compareResult.documentIds.length >= 2 && compareResult.insights.length > 0) {
      state.compareHistory.unshift({
        id: makeId("compare"),
        documentIds: [...compareResult.documentIds],
        documentTitles: compareResult.documentIds.map((documentId) => {
          const document = state.documents.find((item) => item.id === documentId);
          return document?.title ?? "未知文档";
        }),
        generatedAt: now(),
        insights: compareResult.insights.map((insight) => ({ ...insight })),
      });
    }

    return {
      documentIds: [...state.compareResult.documentIds],
      insights: state.compareResult.insights.map((insight) => ({ ...insight })),
    };
  });
}

export function updateDocumentAnalysis(
  documentId: string,
  updates: Partial<Pick<LibraryDocument, "summary" | "sections" | "status" | "language" | "content">>
) {
  return withState((state) => {
    const document = state.documents.find((item) => item.id === documentId);
    if (!document) {
      throw new Error("Document not found.");
    }

    if (updates.summary !== undefined) {
      document.summary = updates.summary;
    }

    if (updates.sections !== undefined) {
      document.sections = updates.sections.map((section) => ({ ...section }));
    }

    if (updates.status !== undefined) {
      document.status = updates.status;
    }

    if (updates.language !== undefined) {
      document.language = updates.language;
    }

    if (updates.content !== undefined) {
      document.content = [...updates.content];
    }

    document.updatedAt = now().slice(0, 10);
    return cloneDocument(document);
  });
}
