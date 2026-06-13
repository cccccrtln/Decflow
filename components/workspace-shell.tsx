"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type {
  Annotation,
  ChatMessage,
  CompareRecord,
  CompareResult,
  FavoriteConversation,
  LibraryDocument,
  ReadingReport,
  WorkspaceData,
} from "@/types/docflow";

export function WorkspaceShell() {
  const uploadInputId = useId();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteConversation[]>([]);
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [question, setQuestion] = useState("");
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [favoriteTitle, setFavoriteTitle] = useState("");
  const [favoriteExcerpt, setFavoriteExcerpt] = useState("");
  const [favoriteCategory, setFavoriteCategory] = useState("随意");
  const [newCategory, setNewCategory] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState("");
  const [hasInitializedCategoryPanel, setHasInitializedCategoryPanel] = useState(false);
  const [expandedFavoriteId, setExpandedFavoriteId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [isShowingFullDocument, setIsShowingFullDocument] = useState(false);
  const [contentFontSize, setContentFontSize] = useState<"small" | "medium" | "large">("medium");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<LibraryDocument["sourceType"]>("pdf");
  const [uploadCategoryId, setUploadCategoryId] = useState("");
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<"compare" | "report" | "favorites" | null>(null);
  const [selectedCompareDocumentIds, setSelectedCompareDocumentIds] = useState<string[]>([]);
  const [isCompareSelectionEditing, setIsCompareSelectionEditing] = useState(false);
  const [isShowingCompareHistory, setIsShowingCompareHistory] = useState(false);
  const [isCompareCompleted, setIsCompareCompleted] = useState(false);
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
  const [expandedFavoriteCategory, setExpandedFavoriteCategory] = useState("");
  const [documentContextMenu, setDocumentContextMenu] = useState<{
    documentId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectionContextMenu, setSelectionContextMenu] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [favoriteContextMenu, setFavoriteContextMenu] = useState<{
    favoriteId: string;
    x: number;
    y: number;
  } | null>(null);
  const [noteContextMenu, setNoteContextMenu] = useState<{
    noteId: string;
    x: number;
    y: number;
  } | null>(null);
  const [categoryContextMenu, setCategoryContextMenu] = useState<{
    categoryId: string;
    x: number;
    y: number;
  } | null>(null);
  const [compareRecordContextMenu, setCompareRecordContextMenu] = useState<{
    recordId: string;
    x: number;
    y: number;
  } | null>(null);
  const [lastSyncedDocumentId, setLastSyncedDocumentId] = useState("");
  const [modelHealthMessage, setModelHealthMessage] = useState<string | null>(null);
  const [qaPanelPlacement, setQaPanelPlacement] = useState<"right" | "bottom">("right");
  const [isNotesFloating, setIsNotesFloating] = useState(false);
  const [notePanelPosition, setNotePanelPosition] = useState({ x: 0, y: 0 });
  const [notePanelWidth, setNotePanelWidth] = useState<number | null>(null);
  const [isDraggingNotes, setIsDraggingNotes] = useState(false);
  const [noteDragOffset, setNoteDragOffset] = useState({ x: 0, y: 0 });
  const [isUploading, startUploadTransition] = useTransition();
  const [isSavingFavorite, startFavoriteTransition] = useTransition();
  const [isSavingCategory, startCategoryTransition] = useTransition();
  const [isAnswering, startAnswerTransition] = useTransition();
  const [isComparing, startCompareTransition] = useTransition();
  const [isReporting, startReportTransition] = useTransition();
  const [isSummarizing, startSummaryTransition] = useTransition();
  const [isGeneratingNavigation, startNavigationTransition] = useTransition();
  const [isIngesting, startIngestTransition] = useTransition();
  const [isCheckingModel, startModelCheckTransition] = useTransition();
  const notePanelRef = useRef<HTMLElement | null>(null);

  const sourceTypeLabelMap: Record<LibraryDocument["sourceType"], string> = {
    pdf: "PDF 文档",
    html: "网页文章",
    docx: "DOCX 文档",
    text: "文本内容",
  };

  const statusLabelMap: Record<LibraryDocument["status"], string> = {
    imported: "待读入",
    ready: "可用",
    processing: "处理中",
    translated: "已翻译",
  };

  const contentFontSizeClassMap: Record<typeof contentFontSize, string> = {
    small: "text-base leading-8",
    medium: "text-lg leading-9",
    large: "text-xl leading-10",
  };

  function getDocumentListStatus(document: LibraryDocument) {
    if (document.status === "imported") {
      return "待读入";
    }

    if (!document.summary || document.sections.length === 0) {
      return "已读入";
    }

    return "已录入";
  }

  const activeDocument = useMemo(() => {
    if (!data) {
      return null;
    }

    return data.documents.find((document) => document.id === activeDocumentId) ?? data.documents[0] ?? null;
  }, [activeDocumentId, data]);

  async function refreshWorkspace(preferredDocumentId?: string) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      setWorkspaceError(null);

      const response = await fetch("/api/workspace", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        setWorkspaceError("刷新工作区数据失败。");
        setIsBooting(false);
        return;
      }

      const nextData = (await response.json()) as WorkspaceData;
      setData(nextData);
      setCompareResult(nextData.compareResult);

      const nextActiveId =
        preferredDocumentId ??
        (nextData.documents.some((document) => document.id === activeDocumentId)
          ? activeDocumentId
          : nextData.documents[0]?.id ?? "");

      setActiveDocumentId(nextActiveId);
      const nextActiveDocument = nextData.documents.find((document) => document.id === nextActiveId);

      if (nextActiveDocument) {
        setMessages(nextActiveDocument.conversation);
        setNotes(nextActiveDocument.notes);
        setFavorites(nextData.favorites);
        setReports(nextActiveDocument.reports);
      } else {
        setMessages([]);
        setNotes([]);
        setFavorites(nextData.favorites);
        setReports([]);
      }

      if (!uploadCategoryId && nextData.categories[0]) {
        setUploadCategoryId(nextData.categories[0].id);
      }

      if (nextData.compareResult.documentIds.length >= 2) {
        setSelectedCompareDocumentIds(nextData.compareResult.documentIds);
        setIsCompareCompleted(nextData.compareResult.insights.length > 0);
      } else {
        setSelectedCompareDocumentIds(nextData.documents.slice(0, 2).map((document) => document.id));
        setIsCompareCompleted(false);
      }
      setIsCompareSelectionEditing(false);
      setIsBooting(false);
    } catch (error) {
      setWorkspaceError(
        error instanceof DOMException && error.name === "AbortError"
          ? "工作区加载超时，请刷新重试。"
          : "工作区加载失败，请刷新重试。"
      );
      setData({
        categories: [],
        documents: [],
        favorites: [],
        compareResult: { documentIds: [], insights: [] },
        compareHistory: [],
      });
      setIsBooting(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  useEffect(() => {
    function handleCloseContextMenu() {
      setDocumentContextMenu(null);
      setSelectionContextMenu(null);
      setFavoriteContextMenu(null);
      setNoteContextMenu(null);
      setCategoryContextMenu(null);
      setCompareRecordContextMenu(null);
    }

    window.addEventListener("click", handleCloseContextMenu);
    window.addEventListener("scroll", handleCloseContextMenu, true);

    return () => {
      window.removeEventListener("click", handleCloseContextMenu);
      window.removeEventListener("scroll", handleCloseContextMenu, true);
    };
  }, []);

  useEffect(() => {
    if (!isDraggingNotes || !isNotesFloating) {
      return;
    }

    function handleMove(event: globalThis.MouseEvent) {
      const panelWidth = notePanelRef.current?.offsetWidth ?? 336;
      const panelHeight = notePanelRef.current?.offsetHeight ?? 420;
      const nextX = Math.min(
        Math.max(16, event.clientX - noteDragOffset.x),
        window.innerWidth - panelWidth - 16
      );
      const nextY = Math.min(
        Math.max(16, event.clientY - noteDragOffset.y),
        window.innerHeight - panelHeight - 16
      );

      setNotePanelPosition({ x: nextX, y: nextY });
    }

    function handleUp() {
      setIsDraggingNotes(false);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingNotes, isNotesFloating, noteDragOffset.x, noteDragOffset.y]);

  useEffect(() => {
    setMessages(activeDocument?.conversation ?? []);
    setNotes(activeDocument?.notes ?? []);
    setFavorites(data?.favorites ?? []);
    setReports(activeDocument?.reports ?? []);

    if ((activeDocument?.id ?? "") !== lastSyncedDocumentId) {
      setSelectedSectionId(activeDocument?.sections[0]?.id ?? "");
      setIsShowingFullDocument(true);
      setLastSyncedDocumentId(activeDocument?.id ?? "");
    }
  }, [activeDocument, data, lastSyncedDocumentId]);

  useEffect(() => {
    if (!data || hasInitializedCategoryPanel) {
      return;
    }

    if (activeDocument && data.categories.some((category) => category.id === activeDocument.categoryId)) {
      setExpandedCategoryId(activeDocument.categoryId);
    }
    setHasInitializedCategoryPanel(true);
  }, [data, activeDocument, hasInitializedCategoryPanel]);

  function handleSelectDocument(document: LibraryDocument) {
    setActiveDocumentId(document.id);
    setMessages(document.conversation);
    setNotes(document.notes);
    setFavorites(data?.favorites ?? []);
    setReports(document.reports);
    setSelectedSectionId(document.sections[0]?.id ?? "");
    setIsShowingFullDocument(true);
    setReportStatus(null);
  }

  function handleAsk() {
    if (!activeDocument || !question.trim()) {
      return;
    }

    const userQuestion = question;
    const optimisticUserMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: userQuestion,
      createdAt: new Date().toISOString(),
    };

    setQuestion("");
    setWorkspaceError(null);
    setMessages((current) => [...current, optimisticUserMessage]);
    setPendingAssistantMessage("思考中...");

    startAnswerTransition(async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeDocument.id, question: userQuestion }),
      });

      if (!response.ok) {
        setWorkspaceError("生成回答失败。");
        setPendingAssistantMessage(null);
        return;
      }

      await refreshWorkspace(activeDocument.id);
      setPendingAssistantMessage(null);
    });
  }

  function handleAddNote() {
    if (!noteInput.trim() || !activeDocument) {
      return;
    }

    const payload = {
      documentId: activeDocument.id,
      anchor: activeDocument.sections[0]?.title ?? "通用",
      note: noteInput,
    };

    setNoteInput("");
    setWorkspaceError(null);

    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        setWorkspaceError("保存笔记失败。");
        return;
      }

      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleToggleNotesFloating() {
    if (isNotesFloating) {
      setIsNotesFloating(false);
      setIsDraggingNotes(false);
      return;
    }

    const panelRect = notePanelRef.current?.getBoundingClientRect();
    if (panelRect) {
      setNotePanelPosition({
        x: panelRect.left,
        y: panelRect.top,
      });
      setNotePanelWidth(panelRect.width);
    }
    setIsNotesFloating(true);
  }

  function handleStartDraggingNotes(event: MouseEvent<HTMLElement>) {
    if (!isNotesFloating) {
      return;
    }

    const panelRect = notePanelRef.current?.getBoundingClientRect();
    if (!panelRect) {
      return;
    }

    setNoteDragOffset({
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top,
    });
    setIsDraggingNotes(true);
  }

  function handleCompare() {
    if (!data) {
      return;
    }

    const documentIds = selectedCompareDocumentIds;

    if (documentIds.length < 2) {
      setWorkspaceError("请至少选择两篇文档进行对比。");
      return;
    }

    setWorkspaceError(null);
    startCompareTransition(async () => {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });

      const body = (await response.json()) as CompareResult | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("文档对比失败。");
        return;
      }

      setCompareResult(body);
      setIsCompareSelectionEditing(false);
      setIsCompareCompleted(true);
      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleToggleCompareDocument(documentId: string) {
    if (!isCompareSelectionEditing) {
      return;
    }

    setSelectedCompareDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  }

  function handleSelectCategoryForCompare(categoryId: string) {
    if (!data || !isCompareSelectionEditing) {
      return;
    }

    const categoryDocumentIds = data.documents
      .filter((document) => document.categoryId === categoryId)
      .map((document) => document.id);

    setSelectedCompareDocumentIds((current) => {
      const hasSelectedAll =
        categoryDocumentIds.length > 0 &&
        categoryDocumentIds.every((documentId) => current.includes(documentId));

      if (hasSelectedAll) {
        return current.filter((documentId) => !categoryDocumentIds.includes(documentId));
      }

      return Array.from(new Set([...current, ...categoryDocumentIds]));
    });
  }

  function handleGenerateReport() {
    if (!activeDocument) {
      return;
    }

    setReportStatus("正在生成报告...");
    setWorkspaceError(null);

    startReportTransition(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeDocument.id }),
      });

      if (!response.ok) {
        setReportStatus("报告生成失败。");
        return;
      }

      await response.json();
      setReportStatus(null);
      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleGenerateSummary() {
    if (!activeDocument) {
      return;
    }

    if (activeDocument.status === "imported") {
      setWorkspaceError("请先完成文档读入。");
      return;
    }

    setWorkspaceError(null);
    startSummaryTransition(async () => {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeDocument.id }),
      });

      const body = (await response.json()) as LibraryDocument | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("摘要生成失败。");
        return;
      }

      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleIngestDocument() {
    if (!activeDocument) {
      return;
    }

    setWorkspaceError(null);
    startIngestTransition(async () => {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeDocument.id }),
      });

      const body = (await response.json()) as LibraryDocument | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("文档读入失败。");
        return;
      }

      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleGenerateNavigation() {
    if (!activeDocument) {
      return;
    }

    if (activeDocument.status === "imported") {
      setWorkspaceError("请先完成文档读入。");
      return;
    }

    setWorkspaceError(null);
    startNavigationTransition(async () => {
      const response = await fetch("/api/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeDocument.id }),
      });

      const body = (await response.json()) as LibraryDocument | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("导航生成失败。");
        return;
      }

      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleCreateCategory() {
    if (!newCategory.trim()) {
      return;
    }

    setWorkspaceError(null);
    startCategoryTransition(async () => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory }),
      });

      if (!response.ok) {
        setWorkspaceError("创建分类失败。");
        return;
      }

      setNewCategory("");
      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleUpload() {
    if (!uploadTitle.trim()) {
      setWorkspaceError("请输入文档标题。");
      return;
    }

    if (!uploadCategoryId) {
      setWorkspaceError("请先创建分类。");
      return;
    }

    if (!uploadContent.trim() && !uploadFile) {
      return;
    }

    setWorkspaceError(null);
    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("sourceType", uploadType);
      formData.append("categoryId", uploadCategoryId);
      formData.append("content", uploadContent);

      if (uploadFile) {
        formData.append("file", uploadFile);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as LibraryDocument | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "创建文档失败。");
        return;
      }

      setUploadTitle("");
      setUploadContent("");
      setUploadFile(null);
      await refreshWorkspace(body.id);
    });
  }

  function handleSelectUploadFile(file: File | null) {
    setUploadFile(file);
    setUploadContent("");

    if (!file) {
      return;
    }

    if (!uploadTitle.trim()) {
      const baseTitle = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(baseTitle);
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
      setUploadType("html");
    } else if (lowerName.endsWith(".docx")) {
      setUploadType("docx");
    } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
      setUploadType("text");
    } else {
      setUploadType("pdf");
    }
  }

  function handleSaveFavorite() {
    if (!activeDocument) {
      return;
    }

    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
    const trimmedExcerpt = favoriteExcerpt.trim();

    if (!latestAssistantMessage && !trimmedExcerpt) {
      return;
    }

    setWorkspaceError(null);
    startFavoriteTransition(async () => {
      const autoTitleSource = trimmedExcerpt || latestAssistantMessage?.content || activeDocument.title;
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDocument.id,
          title: autoTitleSource,
          category: favoriteCategory,
          messageIds: latestAssistantMessage ? [latestAssistantMessage.id] : [],
          excerpt: trimmedExcerpt || undefined,
        }),
      });

      if (!response.ok) {
        setWorkspaceError("加入收藏夹失败。");
        return;
      }

      setFavoriteTitle("");
      setFavoriteExcerpt("");
      setFavoriteCategory("随意");
      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleOpenSelectionContextMenu(event: MouseEvent<HTMLElement>) {
    const selectedText = window.getSelection?.()?.toString().trim() ?? "";
    if (!selectedText) {
      return;
    }

    event.preventDefault();
    setSelectionContextMenu({
      text: selectedText,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleSaveSelectionFavorite() {
    if (!activeDocument || !selectionContextMenu?.text.trim()) {
      return;
    }

    const excerpt = selectionContextMenu.text.trim();

    setWorkspaceError(null);
    setSelectionContextMenu(null);

    startFavoriteTransition(async () => {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDocument.id,
          title: excerpt,
          category: "摘录",
          messageIds: [],
          excerpt,
        }),
      });

      if (!response.ok) {
        setWorkspaceError("加入收藏夹失败。");
        return;
      }

      setFavoriteTitle("");
      setFavoriteExcerpt("");
      setFavoriteCategory("随意");
      await refreshWorkspace(activeDocument.id);
    });
  }

  function handleOpenDocumentContextMenu(
    event: MouseEvent<HTMLButtonElement>,
    documentId: string
  ) {
    event.preventDefault();
    setDocumentContextMenu({
      documentId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleDeleteDocument(documentId: string) {
    setWorkspaceError(null);
    setDocumentContextMenu(null);

    fetch(`/api/documents/${documentId}`, {
      method: "DELETE",
    }).then(async (response) => {
      const body = (await response.json()) as LibraryDocument | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "删除文档失败。");
        return;
      }

      const nextPreferredId =
        activeDocumentId === documentId
          ? data?.documents.find((document) => document.id !== documentId)?.id
          : activeDocumentId;
      await refreshWorkspace(nextPreferredId);
    });
  }

  function handleOpenFavoriteContextMenu(
    event: MouseEvent<HTMLElement>,
    favoriteId: string
  ) {
    event.preventDefault();
    setFavoriteContextMenu({
      favoriteId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleOpenNoteContextMenu(
    event: MouseEvent<HTMLElement>,
    noteId: string
  ) {
    event.preventDefault();
    setNoteContextMenu({
      noteId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleOpenCategoryContextMenu(
    event: MouseEvent<HTMLElement>,
    categoryId: string
  ) {
    event.preventDefault();
    setCategoryContextMenu({
      categoryId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleOpenCompareRecordContextMenu(
    event: MouseEvent<HTMLElement>,
    recordId: string
  ) {
    event.preventDefault();
    setCompareRecordContextMenu({
      recordId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleDeleteFavorite(favoriteId: string) {
    setWorkspaceError(null);
    setFavoriteContextMenu(null);

    fetch(`/api/favorites/${favoriteId}`, {
      method: "DELETE",
    }).then(async (response) => {
      const body = (await response.json()) as FavoriteConversation | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "删除收藏失败。");
        return;
      }

      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleDeleteNote(noteId: string) {
    setWorkspaceError(null);
    setNoteContextMenu(null);

    fetch(`/api/notes/${noteId}`, {
      method: "DELETE",
    }).then(async (response) => {
      const body = (await response.json()) as Annotation | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "删除笔记失败。");
        return;
      }

      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleDeleteCategory(categoryId: string) {
    setWorkspaceError(null);
    setCategoryContextMenu(null);

    fetch(`/api/categories/${categoryId}`, {
      method: "DELETE",
    }).then(async (response) => {
      const body = (await response.json()) as DocumentCategory | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "删除分类失败。");
        return;
      }

      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleDeleteCompareRecord(recordId: string) {
    setWorkspaceError(null);
    setCompareRecordContextMenu(null);

    fetch(`/api/compare/${recordId}`, {
      method: "DELETE",
    }).then(async (response) => {
      const body = (await response.json()) as CompareRecord | { error: string };
      if (!response.ok || "error" in body) {
        setWorkspaceError("error" in body ? body.error : "删除对比记录失败。");
        return;
      }

      await refreshWorkspace(activeDocument?.id);
    });
  }

  function handleCheckModelHealth() {
    setModelHealthMessage(null);
    startModelCheckTransition(async () => {
      const response = await fetch("/api/health/model", {
        method: "GET",
        cache: "no-store",
      });

      const body = (await response.json()) as {
        ok: boolean;
        model?: string;
        content?: string;
        error?: string;
      };

      if (!response.ok || !body.ok) {
        setModelHealthMessage(body.error ?? "模型连通性测试失败。");
        return;
      }

      setModelHealthMessage(`模型连通成功：${body.model} / ${body.content ?? ""}`);
    });
  }


  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f7f1e5_0%,_#efe6d4_100%)] text-ink">
        <div className="panel p-8 text-center">
          <p className="text-sm tracking-[0.2em] text-ember">从篇</p>
          <p className="mt-3 text-lg">正在加载工作区...</p>
          {workspaceError ? (
            <p className="mt-4 text-sm text-red-600">{workspaceError}</p>
          ) : null}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f7f1e5_0%,_#efe6d4_100%)] text-ink">
        <div className="panel max-w-md p-8 text-center">
          <p className="text-lg font-semibold">工作区暂时不可用</p>
          <p className="mt-3 text-sm text-black/65">
            应用未能加载文档工作区，请检查接口状态后刷新页面。
          </p>
        </div>
      </main>
    );
  }

  const categories = data.categories;
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const compareSelectionCount = selectedCompareDocumentIds.length;
  const compareHistory = data.compareHistory ?? [];
  const hasGeneratedReport = reports.length > 0;
  const hasDocuments = data.documents.length > 0;
  const favoriteGroups = favorites.reduce<Record<string, FavoriteConversation[]>>((groups, favorite) => {
    const category = favorite.category || "随意";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(favorite);
    return groups;
  }, {});
  const currentCompareTitle = (compareResult?.documentIds ?? [])
    .map((documentId) => data.documents.find((document) => document.id === documentId)?.title ?? "未知文档")
    .join(" vs ");
  const selectedSection =
    activeDocument?.sections.find((section) => section.id === selectedSectionId) ?? null;
  const notePanel = (
    <section
      ref={notePanelRef}
      className={`rounded-3xl border border-black/10 bg-white/55 p-4 backdrop-blur-sm ${
        isNotesFloating ? "z-[70] shadow-[0_18px_40px_rgba(157,183,217,0.28)]" : ""
      }`}
      style={
        isNotesFloating
          ? {
              left: notePanelPosition.x,
              position: "fixed",
              top: notePanelPosition.y,
              width: notePanelWidth ?? undefined,
            }
          : undefined
      }
    >
      <div
        className={`flex items-center justify-between ${
          isNotesFloating ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onMouseDown={handleStartDraggingNotes}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-black/70">
          <svg
            aria-hidden="true"
            className="h-[23px] w-[23px]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="m15.2 5.3 3.5 3.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.55"
            />
            <path
              d="m8.2 18.2 1.1-4.3 7.9-7.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-7.9 7.9-4.3 1.1Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.55"
            />
            <path
              d="M8 18.4l2.9-.8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.55"
            />
          </svg>
        </span>
        <button
          className="rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-xs text-black/65 transition hover:bg-white/75"
          onClick={handleToggleNotesFloating}
          type="button"
        >
          {isNotesFloating ? "回" : "移"}
        </button>
      </div>
      <textarea
        className="mt-3 min-h-24 w-full rounded-2xl border border-black/10 bg-white/60 p-3 text-sm outline-none focus:border-[#9db7d9]"
        onChange={(event) => setNoteInput(event.target.value)}
        placeholder="记录阅读笔记或批注..."
        value={noteInput}
      />
      <button
        className="mt-3 w-full rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm"
        onClick={handleAddNote}
        type="button"
      >
        保存笔记
      </button>
      <div className="mt-4 space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`rounded-2xl p-3 text-sm leading-6 text-black/70 ${
              isNotesFloating ? "bg-white/60" : "bg-[#f3f6f8]"
            }`}
            onContextMenu={(event) => handleOpenNoteContextMenu(event, note.id)}
          >
            <p>{note.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
  const visibleParagraphs = !activeDocument
    ? []
    : isShowingFullDocument
      ? activeDocument.content.map((paragraph, index) => ({
          id: `${activeDocument.id}-${index}`,
          title: activeDocument.sections[index]?.title ?? `章节 ${index + 1}`,
          content: paragraph,
        }))
      : selectedSection
        ? activeDocument.content
            .slice(selectedSection.paragraphStart, selectedSection.paragraphEnd + 1)
            .map((paragraph, index) => ({
              id: `${selectedSection.id}-${selectedSection.paragraphStart + index}`,
              title: selectedSection.title,
              content: paragraph,
            }))
        : activeDocument.content.map((paragraph, index) => ({
            id: `${activeDocument.id}-${index}`,
            title: activeDocument.sections[index]?.title ?? `章节 ${index + 1}`,
            content: paragraph,
          }));

  function renderMarkdownInline(text: string): ReactNode[] {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);

    return parts.flatMap((part, index) => {
      if (!part) {
        return [];
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={`code-${index}`} className="rounded-md bg-white/70 px-1.5 py-0.5 text-[0.92em] text-[#536b7c]">
            {part.slice(1, -1)}
          </code>
        );
      }

      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return (
          <strong key={`strong-${index}`} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return (
          <em key={`em-${index}`} className="text-black/70">
            {part.slice(1, -1)}
          </em>
        );
      }

      return part.split("\n").flatMap((line, lineIndex, lines) => {
        const nodes: ReactNode[] = [line];
        if (lineIndex < lines.length - 1) {
          nodes.push(<br key={`br-${index}-${lineIndex}`} />);
        }
        return nodes;
      });
    });
  }

  function renderMarkdownBlock(markdown: string, key: string) {
    const text = markdown.trim();

    if (!text) {
      return <div key={key} className="h-3" />;
    }

    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const className =
        level <= 2
          ? "mt-2 text-[1.2em] font-semibold leading-8 text-ink"
          : "mt-1 text-[1.08em] font-semibold leading-7 text-ink";

      return (
        <h3 key={key} className={className} data-font-role="label">
          {renderMarkdownInline(headingMatch[2])}
        </h3>
      );
    }

    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const unorderedItems = lines.map((line) => line.match(/^[-*]\s+(.+)$/)).filter(Boolean);
    if (unorderedItems.length === lines.length && lines.length > 1) {
      return (
        <ul key={key} className="list-disc space-y-2 pl-6">
          {unorderedItems.map((match, index) => (
            <li key={`${key}-li-${index}`}>{renderMarkdownInline(match?.[1] ?? "")}</li>
          ))}
        </ul>
      );
    }

    const orderedItems = lines.map((line) => line.match(/^\d+[.)]\s+(.+)$/)).filter(Boolean);
    if (orderedItems.length === lines.length && lines.length > 1) {
      return (
        <ol key={key} className="list-decimal space-y-2 pl-6">
          {orderedItems.map((match, index) => (
            <li key={`${key}-li-${index}`}>{renderMarkdownInline(match?.[1] ?? "")}</li>
          ))}
        </ol>
      );
    }

    const quoteMatch = text.match(/^>\s?(.+)$/s);
    if (quoteMatch) {
      return (
        <blockquote key={key} className="border-l-2 border-[#cdd9e7] pl-4 text-black/62">
          {renderMarkdownInline(quoteMatch[1])}
        </blockquote>
      );
    }

    return <p key={key}>{renderMarkdownInline(text)}</p>;
  }

  function renderFontSizeIcon(size: "small" | "medium" | "large") {
    const dotSizeClassMap = {
      small: "h-2.5 w-2.5",
      medium: "h-3.5 w-3.5",
      large: "h-4.5 w-4.5",
    } satisfies Record<typeof size, string>;

    return <span aria-hidden="true" className={`rounded-full bg-current ${dotSizeClassMap[size]}`} />;
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_16%_14%,_#f4f7ff_0%,_#eaf0fb_22%,_transparent_44%),radial-gradient(circle_at_82%_18%,_#edf1fb_0%,_#e3e9f8_24%,_transparent_46%),radial-gradient(circle_at_52%_82%,_#e8e1cf_0%,_#d9e1f4_26%,_transparent_50%),linear-gradient(180deg,_#edf1fb_0%,_#dce4f4_52%,_#d5dcef_100%)] p-5 text-ink before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(rgba(255,255,255,0.16)_0.7px,transparent_0.9px)] before:bg-[size:10px_10px] before:opacity-[0.16] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.03)_30%,rgba(196,208,233,0.06)_58%,rgba(255,255,255,0.02)_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-11rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(184,201,242,0.58)_0%,_rgba(184,201,242,0.24)_34%,_transparent_74%)] blur-[110px]" />
        <div className="absolute right-[-10rem] top-[-4rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(182,204,242,0.54)_0%,_rgba(182,204,242,0.22)_36%,_transparent_76%)] blur-[108px]" />
        <div className="absolute left-[18%] bottom-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(176,207,235,0.46)_0%,_rgba(176,207,235,0.18)_34%,_transparent_76%)] blur-[118px]" />
        <div className="absolute right-[12%] bottom-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(225,213,184,0.42)_0%,_rgba(225,213,184,0.15)_34%,_transparent_78%)] blur-[112px]" />
        <div className="absolute left-0 top-[8%] h-[84%] w-[5rem] bg-[linear-gradient(90deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_38%,transparent_88%)] opacity-72" />
        <div className="absolute right-0 top-[10%] h-[80%] w-[5rem] bg-[linear-gradient(270deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06)_38%,transparent_88%)] opacity-72" />
        <div className="absolute left-4 top-[16%] h-[68%] w-[3px] rounded-full bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.68),rgba(200,217,248,0.52),transparent)] opacity-88 shadow-[0_0_20px_rgba(255,255,255,0.34)]" />
        <div className="absolute right-4 top-[18%] h-[64%] w-[3px] rounded-full bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.66),rgba(205,220,245,0.48),rgba(232,223,195,0.34),transparent)] opacity-88 shadow-[0_0_20px_rgba(255,255,255,0.32)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.06]" />
      </div>
      <div className="mx-auto grid h-[calc(100vh-40px)] max-w-[1920px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="panel relative flex min-h-0 flex-col overflow-hidden p-4">
          <div className="absolute inset-x-4 top-4 z-10 border-b border-black/10 bg-white/70 pb-4 pt-1 backdrop-blur">
            <div className="ml-1 flex items-center gap-0.5">
              <p className="text-sm tracking-[0.28em] text-[#8fb7a2]" data-font-role="title">
                从篇
              </p>
              <span className="flex h-6 w-6 items-center justify-center text-[#8fb7a2]">
                <svg
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6.75 7.25c0-1.1.9-2 2-2h6.1c.5 0 .98.2 1.33.55l1.27 1.27c.35.35.55.83.55 1.33v7.85c0 1.1-.9 2-2 2h-7.25c-1.1 0-2-.9-2-2v-9Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.45"
                  />
                  <path d="M14.5 5.5v3.25h3.25" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.45" />
                  <path d="M9.25 11h5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.45" />
                  <path d="M9.25 13.8h5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.45" />
                </svg>
              </span>
            </div>
            <h1
              className="ml-2 mt-2 text-3xl leading-tight text-[#445149]"
              style={{ fontFamily: '"Iowan Old Style","Palatino Linotype","Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif' }}
            >
              文档阅读工作台
            </h1>
            <p className="ml-2 mt-2 text-xs leading-5 text-black/65">
              上传、分类、阅读、提问、整理。
            </p>
            <button
              className="mt-3 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/65 transition hover:bg-paper disabled:opacity-60"
              disabled={isCheckingModel}
              onClick={handleCheckModelHealth}
              type="button"
            >
              {isCheckingModel ? "测试中..." : "测试模型连接"}
            </button>
            {modelHealthMessage ? (
              <p className="mt-2 text-xs leading-5 text-black/60">{modelHealthMessage}</p>
            ) : null}
          </div>

          <div className="-mr-4 min-h-0 flex-1 overflow-y-auto pr-1 pt-[11rem] [scrollbar-color:#edf0f8_transparent] [scrollbar-width:thin]">
          <div className="mr-3">

          <section className="mb-5">
            <p className="mb-3 text-sm font-semibold" data-font-role="label">创建文档</p>
            <div className="mb-4 space-y-2 rounded-3xl border border-black/10 bg-[#edf2f6] p-3">
              <input
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ember"
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="文档标题"
                value={uploadTitle}
              />
              <select
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ember"
                onChange={(event) => {
                  setUploadType(event.target.value as LibraryDocument["sourceType"]);
                  setUploadFile(null);
                  setUploadContent("");
                }}
                value={uploadType}
              >
                <option value="pdf">PDF 文档</option>
                <option value="html">网页文章</option>
                <option value="docx">DOCX 文档</option>
                <option value="text">文本粘贴</option>
              </select>
              <select
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ember"
                onChange={(event) => setUploadCategoryId(event.target.value)}
                value={uploadCategoryId}
              >
                {categories.length ? (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                ) : (
                  <option value="">请先创建分类</option>
                )}
              </select>
              {uploadType === "text" ? (
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-ember"
                  onChange={(event) => setUploadContent(event.target.value)}
                  placeholder="直接粘贴正文内容"
                  value={uploadContent}
                />
              ) : (
                <label className="block rounded-2xl border border-dashed border-black/15 bg-white px-3 py-2 text-sm text-black/65">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-black/45">
                      {uploadType === "pdf"
                        ? "选择 PDF 文件"
                        : uploadType === "html"
                          ? "选择 HTML 文件"
                          : "选择 DOCX 文件"}
                    </span>
                    <input
                      accept={
                        uploadType === "pdf"
                          ? ".pdf"
                          : uploadType === "html"
                            ? ".html,.htm"
                            : ".docx"
                      }
                      className="hidden"
                      id={uploadInputId}
                      onChange={(event) => handleSelectUploadFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                    <label
                      className="inline-flex cursor-pointer rounded-full bg-[#e8d8c7] px-2.5 py-1 text-xs text-ink"
                      htmlFor={uploadInputId}
                    >
                      选择文件
                    </label>
                  </div>
                    {uploadFile ? (
                      <p className="mt-2 text-xs text-black/50">已选择：{uploadFile.name}</p>
                    ) : null}
                </label>
              )}
              <button
                className="w-full rounded-full bg-[#a8a39b] px-3 py-2 text-sm text-white disabled:opacity-60"
                disabled={isUploading}
                onClick={handleUpload}
                type="button"
              >
                {isUploading ? "创建中..." : "创建文档"}
              </button>
            </div>
          </section>

          <section className="mb-5">
            <p className="mb-3 text-sm font-semibold" data-font-role="label">文档分类</p>
            <div className="space-y-2">
              {categories.length ? categories.map((category) => {
                const categoryDocuments = data.documents.filter(
                  (document) => document.categoryId === category.id
                );
                const isExpanded = expandedCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className="rounded-2xl border border-black/10 bg-paper/70"
                    onContextMenu={(event) => handleOpenCategoryContextMenu(event, category.id)}
                  >
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                      onClick={() => {
                        if (expandedCategoryId === category.id) {
                          setExpandedCategoryId("");
                          return;
                        }

                        setExpandedCategoryId(category.id);
                      }}
                      type="button"
                    >
                      <span className="text-sm font-medium text-ink" data-font-role="label">
                        {category.name}
                      </span>
                      <span className="text-xs text-black/50">{isExpanded ? "收起" : "展开"}</span>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-black/10 px-2 py-2">
                        {categoryDocuments.length ? (
                          <div className="space-y-1">
                            {categoryDocuments.map((document) => (
                              <button
                                key={document.id}
                                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                                  document.id === activeDocument?.id
                                    ? "bg-[#edf2fb] text-ink"
                                    : "text-black/70 hover:bg-white/80"
                                }`}
                                onClick={() => handleSelectDocument(document)}
                                onContextMenu={(event) => handleOpenDocumentContextMenu(event, document.id)}
                                type="button"
                                data-font-role="label"
                              >
                                {document.title}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-2 text-sm text-black/45">该分类下暂无文档</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-4 text-sm text-black/45">
                  暂无分类，请先创建分类。
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-full border border-black/10 bg-paper px-3 py-2 text-sm outline-none focus:border-ember"
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="新建分类"
                value={newCategory}
              />
              <button
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs disabled:opacity-60"
                disabled={isSavingCategory}
                onClick={handleCreateCategory}
                type="button"
              >
                {isSavingCategory ? "保存中" : "添加"}
              </button>
            </div>
          </section>

          <section className="flex-1">
            <p className="mb-3 text-sm font-semibold text-ink" data-font-role="label">文档列表</p>
            <div className="space-y-3">
              {data.documents.length ? data.documents.map((document) => {
                const isActive = document.id === activeDocument?.id;
                return (
                  <button
                    key={document.id}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      isActive
                        ? "border-[#c6d6df] bg-[#f1f6f8]"
                        : "border-black/10 bg-white/70 hover:border-black/20"
                    }`}
                    onClick={() => handleSelectDocument(document)}
                    onContextMenu={(event) => handleOpenDocumentContextMenu(event, document.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs tracking-[0.18em] text-black/45">
                        {sourceTypeLabelMap[document.sourceType]}
                      </p>
                      <p className="shrink-0 text-xs text-black/45">
                        {getDocumentListStatus(document)}
                      </p>
                    </div>
                    <p className="mt-1 font-medium" data-font-role="label">{document.title}</p>
                    <p className="mt-1 text-sm text-black/60">{categoryMap.get(document.categoryId)}</p>
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-4 text-sm leading-6 text-black/45">
                  暂无文档。创建分类后即可上传真实文章。
                </div>
              )}
            </div>
          </section>
          </div>
          </div>
        </aside>

        <section className="panel relative flex min-h-0 flex-col overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 bottom-0 h-[16rem] overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-full bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(238,241,251,0.08)_20%,rgba(222,228,247,0.2)_44%,rgba(198,206,239,0.38)_100%)]" />
            </div>
            <div className="absolute bottom-[1px] left-8 h-[1.5px] w-20 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,1),rgba(255,255,255,0.82),rgba(255,255,255,0))] shadow-[0_0_14px_rgba(255,255,255,0.56),0_0_24px_rgba(255,255,255,0.34)] blur-[0.4px]" />
            <div className="absolute bottom-8 left-[1px] h-16 w-[1.5px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,1),rgba(255,255,255,0.68),rgba(255,255,255,0))] shadow-[0_0_14px_rgba(255,255,255,0.48),0_0_24px_rgba(255,255,255,0.28)] blur-[0.4px]" />
          </div>
          {activeDocument ? (
            <div className="relative mb-6 border-b border-black/10 pb-5 pr-[19rem]">
              <div className="ml-10 pt-4">
                <h2
                  className="mt-2 text-5xl font-normal leading-tight"
                  style={{ fontFamily: '"Iowan Old Style","Palatino Linotype","Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif' }}
                >
                  {activeDocument.title}
                </h2>
                {activeDocument.status === "imported" ? null : activeDocument.summary ? (
                  <>
                    <div className="mt-2 flex justify-end pt-5">
                      <p className="w-full max-w-[38rem] text-base leading-8 text-black/70" data-font-role="body">
                        {activeDocument.summary}
                      </p>
                    </div>
                    <button
                      className={`mt-3 rounded-full border border-black/10 px-4 py-2 text-sm transition ${
                        isShowingFullDocument
                          ? "bg-[#e8d8c7] text-ink hover:bg-[#e8d8c7]"
                          : "bg-white/80 text-ink hover:bg-white"
                      }`}
                      onPointerDown={() => setIsShowingFullDocument(true)}
                      type="button"
                    >
                      阅读全文
                    </button>
                  </>
                ) : (
                  <button
                    className="mt-4 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-ink transition hover:bg-white disabled:opacity-60"
                    disabled={isSummarizing}
                    onClick={handleGenerateSummary}
                    type="button"
                  >
                    {isSummarizing ? "正在生成摘要" : "开始摘要"}
                  </button>
                )}
              </div>
              <div className="absolute right-0 top-0 bottom-5 flex w-[280px] min-w-[180px] flex-col rounded-2xl border border-black/10 bg-paper/80 p-4 text-sm text-black/65">
                <p className="font-semibold text-ink" data-font-role="label">章节导航</p>
                {activeDocument.status === "imported" ? null : activeDocument.sections.length ? (
                  <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-3 [scrollbar-color:#e7ebf7_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#e7ebf7] [&::-webkit-scrollbar-track]:bg-transparent">
                    {activeDocument.sections.map((section) => (
                      <li key={section.id}>
                        <button
                          className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                            !isShowingFullDocument && selectedSectionId === section.id
                              ? "bg-[#e8d8c7] text-ink hover:bg-[#e8d8c7]"
                              : "bg-white/60 text-black/65 hover:bg-white"
                          }`}
                          onPointerDown={() => {
                            setSelectedSectionId(section.id);
                            setIsShowingFullDocument(false);
                          }}
                          type="button"
                        >
                          <p className="font-medium text-ink" data-font-role="label">{section.title}</p>
                          <p className="mt-1 text-xs leading-5">{section.summary}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button
                    className="mt-3 w-full rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-ink transition hover:bg-white disabled:opacity-60"
                    disabled={isGeneratingNavigation}
                    onClick={handleGenerateNavigation}
                    type="button"
                  >
                    {isGeneratingNavigation ? "生成中..." : "生成导航"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-3xl border border-dashed border-black/10 bg-white/55 px-10 py-12">
              <h2
                className="text-4xl font-normal leading-tight text-[#445149]"
                style={{ fontFamily: '"Iowan Old Style","Palatino Linotype","Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif' }}
              >
                还没有文档
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-black/65">
                先在左侧创建分类，再上传真实文章。创建完成后，这里会显示摘要、章节导航、正文和问答区域。
              </p>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-color:transparent_transparent] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0">
            <div className={qaPanelPlacement === "right" ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" : "space-y-6"}>
            <article className="space-y-4" onContextMenu={activeDocument ? handleOpenSelectionContextMenu : undefined}>
              {!activeDocument ? (
                <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 p-10 text-center text-black/55">
                  创建文档后，这里会呈现读入后的正文内容。
                </div>
              ) : activeDocument.status === "imported" ? (
                <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-center">
                  <button
                    className="rounded-full border border-black/10 bg-[#e8d8c7] px-5 py-2 text-sm text-ink transition hover:bg-[#decbb7] disabled:opacity-60"
                    disabled={isIngesting}
                    onClick={handleIngestDocument}
                    type="button"
                  >
                    {isIngesting ? "读入中..." : "开始读入"}
                  </button>
                </div>
              ) : isShowingFullDocument ? (
                <div className="relative rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_18px_rgba(243,232,214,0.18),0_0_30px_rgba(226,212,190,0.16)]">
                  <div className="absolute inset-x-6 top-6 z-10 bg-white/65 px-3 py-2 backdrop-blur">
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "small"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("small")}
                        type="button"
                      >
                        {renderFontSizeIcon("small")}
                      </button>
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "medium"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("medium")}
                        type="button"
                      >
                        {renderFontSizeIcon("medium")}
                      </button>
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "large"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("large")}
                        type="button"
                      >
                        {renderFontSizeIcon("large")}
                      </button>
                    </div>
                  </div>
                  <div className={`-mr-4 max-h-[640px] overflow-y-auto pr-0 pt-12 text-black/78 [scrollbar-color:#e7ebf7_transparent] [scrollbar-width:thin] ${contentFontSizeClassMap[contentFontSize]}`} data-font-role="reader">
                    <div className="space-y-6 pl-8 pr-14">
                      {visibleParagraphs.map((paragraph) => (
                        renderMarkdownBlock(paragraph.content, paragraph.id)
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {activeDocument &&
              !isShowingFullDocument &&
              activeDocument.status !== "imported" &&
              activeDocument.sections.length === 0 ? (
                <div className="relative rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_18px_rgba(243,232,214,0.18),0_0_30px_rgba(226,212,190,0.16)]">
                  <div className="absolute inset-x-6 top-6 z-10 bg-white/65 px-3 py-2 backdrop-blur">
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "small"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("small")}
                        type="button"
                      >
                        {renderFontSizeIcon("small")}
                      </button>
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "medium"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("medium")}
                        type="button"
                      >
                        {renderFontSizeIcon("medium")}
                      </button>
                      <button
                        className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                          contentFontSize === "large"
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        }`}
                        onClick={() => setContentFontSize("large")}
                        type="button"
                      >
                        {renderFontSizeIcon("large")}
                      </button>
                    </div>
                  </div>
                  <div className={`-mr-4 max-h-[640px] overflow-y-auto pr-0 text-black/78 [scrollbar-color:#e7ebf7_transparent] [scrollbar-width:thin] ${contentFontSizeClassMap[contentFontSize]}`} data-font-role="reader">
                    <div className="space-y-6 pl-8 pr-14">
                      {activeDocument.content.map((paragraph, index) => (
                        renderMarkdownBlock(paragraph, `${activeDocument.id}-content-${index}`)
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {activeDocument &&
              !isShowingFullDocument &&
              activeDocument.status !== "imported" &&
              activeDocument.sections.length > 0
                ? (
                  <div className="relative rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_18px_rgba(243,232,214,0.18),0_0_30px_rgba(226,212,190,0.16)]">
                    <div className="absolute inset-x-6 top-6 z-10 bg-white/65 px-3 py-2 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        {selectedSection ? (
                          <p className="text-sm font-medium tracking-[0.08em] text-black/45" data-font-role="label">
                            {selectedSection.title}
                          </p>
                        ) : (
                          <span />
                        )}
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                              contentFontSize === "small"
                                ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                                : "border-black/10 bg-white text-black/65 hover:bg-paper"
                            }`}
                            onClick={() => setContentFontSize("small")}
                            type="button"
                          >
                            {renderFontSizeIcon("small")}
                          </button>
                          <button
                            className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                              contentFontSize === "medium"
                                ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                                : "border-black/10 bg-white text-black/65 hover:bg-paper"
                            }`}
                            onClick={() => setContentFontSize("medium")}
                            type="button"
                          >
                            {renderFontSizeIcon("medium")}
                          </button>
                          <button
                            className={`w-9 rounded-full border px-0 py-1 text-center text-xs transition ${
                              contentFontSize === "large"
                                ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                                : "border-black/10 bg-white text-black/65 hover:bg-paper"
                            }`}
                            onClick={() => setContentFontSize("large")}
                            type="button"
                          >
                            {renderFontSizeIcon("large")}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={`-mr-4 max-h-[640px] overflow-y-auto pr-0 pt-12 text-black/78 [scrollbar-color:#e7ebf7_transparent] [scrollbar-width:thin] ${contentFontSizeClassMap[contentFontSize]}`} data-font-role="reader">
                      <div className="space-y-6 pl-8 pr-14">
                        {visibleParagraphs.map((paragraph) => (
                          renderMarkdownBlock(paragraph.content, paragraph.id)
                        ))}
                      </div>
                    </div>
                  </div>
                )
                : null}
            </article>

            <div className={`flex h-[560px] max-h-[560px] min-h-0 flex-col rounded-3xl border border-black/10 bg-[linear-gradient(180deg,_#f6efe6_0%,_#eef3f8_100%)] p-4 ${qaPanelPlacement === "right" ? "" : "w-full"}`}>
              <div className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2">
                <p className="text-sm font-semibold text-ink" data-font-role="label">问答</p>
                <div className="flex items-center gap-2">
                  <button
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      qaPanelPlacement === "right"
                        ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                        : "border-black/10 bg-white text-black/65 hover:bg-paper"
                    }`}
                    onClick={() => setQaPanelPlacement("right")}
                    type="button"
                  >
                    →
                  </button>
                  <button
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      qaPanelPlacement === "bottom"
                        ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                        : "border-black/10 bg-white text-black/65 hover:bg-paper"
                    }`}
                    onClick={() => setQaPanelPlacement("bottom")}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-3 [scrollbar-color:rgba(255,255,255,0.65)_transparent] [scrollbar-width:thin]">
                {!activeDocument && !messages.length ? (
                  <div className="rounded-2xl bg-white/70 p-4 text-sm leading-7 text-black/55">
                    选中或创建文档后，可以在这里基于正文提问。
                  </div>
                ) : null}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl p-4 text-sm leading-7 ${
                      message.role === "assistant" ? "bg-white text-black/75" : "bg-[#eef3f8] text-ink"
                    }`}
                  >
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-black/40">
                      {message.role === "assistant" ? "智能体" : "用户"}
                    </p>
                    <p>{message.content}</p>
                    {message.citations?.length ? (
                      <div className="mt-3 space-y-2 border-t border-black/10 pt-3">
                        {message.citations.map((citation) => (
                          <div key={citation.id} className="rounded-2xl bg-paper px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-ember">
                              {citation.label}
                            </p>
                            <p className="text-xs text-black/60">{citation.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {pendingAssistantMessage ? (
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-black/75">
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-black/40">智能体</p>
                    <p>{pendingAssistantMessage}</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <textarea
                  className="min-h-20 w-full rounded-2xl border border-black/10 bg-white/85 p-3 text-sm outline-none focus:border-[#9db7d9]"
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="基于当前文档提问..."
                  value={question}
                />
                <button
                  className="mt-3 w-full rounded-full bg-[#8b857c] px-4 py-2.5 text-sm text-white disabled:opacity-60"
                  disabled={isAnswering}
                  onClick={handleAsk}
                  type="button"
                >
                  发送问题
                </button>
              </div>
            </div>
            </div>
          </div>
        </section>

        <aside className="panel relative flex min-h-0 flex-col overflow-hidden p-4">
          <section className="absolute inset-x-4 top-4 z-10 rounded-3xl border border-black/10 bg-white/70 p-4 backdrop-blur">
            <div className="grid grid-cols-3 gap-3">
              <button
                className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-sm transition ${
                  activeRightPanel === "compare"
                    ? "border-[#c6d6df] bg-[#f1f6f8] text-[#5e7687]"
                    : "border-black/10 bg-paper/70 text-black/70"
                }`}
                onClick={() =>
                  setActiveRightPanel((current) => (current === "compare" ? null : "compare"))
                }
                type="button"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <svg
                    aria-hidden="true"
                    className="h-[22px] w-[22px]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <rect
                      height="11"
                      rx="2.75"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.55"
                      width="6.5"
                      x="4"
                      y="6.5"
                    />
                    <rect
                      height="11"
                      rx="2.75"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.55"
                      width="6.5"
                      x="13.5"
                      y="6.5"
                    />
                    <path d="M10.9 12h2.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
                  </svg>
                </span>
                <span>文档对比</span>
              </button>
              <button
                className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-sm transition ${
                  activeRightPanel === "report"
                    ? "border-[#c6d6df] bg-[#f1f6f8] text-[#5e7687]"
                    : "border-black/10 bg-paper/70 text-black/70"
                }`}
                onClick={() =>
                  setActiveRightPanel((current) => (current === "report" ? null : "report"))
                }
                type="button"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <svg
                    aria-hidden="true"
                    className="h-[22px] w-[22px]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M8.25 4.75h5.75l2.75 2.75V18a1.25 1.25 0 0 1-1.25 1.25h-7A1.25 1.25 0 0 1 7.25 18V6a1.25 1.25 0 0 1 1-1.25Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.55"
                    />
                    <path d="M14 4.75V8h2.75" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.55" />
                    <path d="M9.75 11h4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
                    <path d="M9.75 14h4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
                  </svg>
                </span>
                <span>阅读报告</span>
              </button>
              <button
                className={`flex flex-col items-center rounded-2xl border px-3 py-3 text-sm transition ${
                  activeRightPanel === "favorites"
                    ? "border-[#c6d6df] bg-[#f1f6f8] text-[#5e7687]"
                    : "border-black/10 bg-paper/70 text-black/70"
                }`}
                onClick={() =>
                  setActiveRightPanel((current) => (current === "favorites" ? null : "favorites"))
                }
                type="button"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <svg
                    aria-hidden="true"
                    className="h-[22px] w-[22px]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m12 5.2 2.02 4.08 4.51.66-3.26 3.18.77 4.48L12 15.42l-4.04 2.18.77-4.48-3.26-3.18 4.51-.66L12 5.2Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.55"
                    />
                  </svg>
                </span>
                <span>收藏夹</span>
              </button>
            </div>
          </section>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-3 pt-36 [scrollbar-color:#edf0f8_transparent] [scrollbar-width:thin]">

          {activeRightPanel === "compare" ? (
            <section className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold" data-font-role="label">文档对比</p>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/65 transition hover:bg-paper"
                    onClick={() => {
                      setSelectedCompareDocumentIds([]);
                      setIsCompareSelectionEditing(true);
                      setIsShowingCompareHistory(false);
                      setIsCompareCompleted(false);
                    }}
                    type="button"
                  >
                    重选
                  </button>
                <button
                  className="rounded-full bg-[#7f99b8] px-3 py-1.5 text-xs text-white disabled:opacity-60"
                  disabled={isComparing || data.documents.length < 2}
                  onClick={handleCompare}
                  type="button"
                >
                    {isComparing ? "对比中..." : isCompareCompleted ? "对比完成" : "开始对比"}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-paper/70 p-3">
                <p className="text-xs tracking-[0.16em] text-black/45">
                  已选择 {compareSelectionCount} 篇文档
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const categoryDocumentIds = data.documents
                      .filter((document) => document.categoryId === category.id)
                      .map((document) => document.id);
                    const isCategorySelected =
                      categoryDocumentIds.length > 0 &&
                      categoryDocumentIds.every((documentId) =>
                        selectedCompareDocumentIds.includes(documentId)
                      );

                    return (
                      <button
                        key={category.id}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          isCategorySelected
                            ? "border-[#c7a78a] bg-[#e8d8c7] text-ink"
                            : "border-black/10 bg-white text-black/65 hover:bg-paper"
                        } ${!isCompareSelectionEditing ? "cursor-default opacity-60" : ""}`}
                        disabled={!isCompareSelectionEditing}
                        onClick={() => handleSelectCategoryForCompare(category.id)}
                        type="button"
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 space-y-2">
                  {data.documents.map((document) => {
                    const isSelected = selectedCompareDocumentIds.includes(document.id);
                    return (
                      <button
                        key={document.id}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-[#c6d6df] bg-[#f1f6f8] text-ink"
                            : "border-black/10 bg-white/80 text-black/70 hover:bg-white"
                        } ${!isCompareSelectionEditing ? "cursor-default opacity-60" : ""}`}
                        disabled={!isCompareSelectionEditing}
                        onClick={() => handleToggleCompareDocument(document.id)}
                        type="button"
                      >
                        <div>
                          <p className="font-medium" data-font-role="label">{document.title}</p>
                          <p className="mt-1 text-xs text-black/45">
                            {categoryMap.get(document.categoryId)}
                          </p>
                        </div>
                        <span className="text-xs">
                          {isSelected ? "已选中" : "选择"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {isCompareCompleted && compareResult?.insights?.length ? (
                <div className="mt-4 space-y-3 text-sm leading-6 text-black/70">
                  {currentCompareTitle ? (
                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <p className="font-medium text-ink" data-font-role="label">{currentCompareTitle}</p>
                    </div>
                  ) : null}
                  {compareResult.insights.map((insight) => (
                    <div key={insight.topic} className="rounded-2xl border border-black/10 bg-paper/70 p-3">
                      <p className="font-medium text-ink" data-font-role="label">{insight.topic}</p>
                      <p className="mt-1">共识：{insight.consensus}</p>
                      <p className="mt-1">差异：{insight.difference}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeRightPanel === "report" ? (
            <section className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" data-font-role="label">阅读报告</p>
                <button
                  className="rounded-full bg-[#7f99b8] px-3 py-1.5 text-xs text-white disabled:opacity-60"
                  disabled={isReporting || !activeDocument}
                  onClick={handleGenerateReport}
                  type="button"
                >
                  {isReporting ? "生成中..." : hasGeneratedReport ? "重新生成" : "生成报告"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-black/65">
                基于当前文档处理后的正文、用户笔记和聊天记录生成阅读报告。
              </p>
              {reportStatus ? (
                <div className="mt-4 rounded-2xl bg-paper/80 p-3 text-sm text-black/70">
                  {reportStatus}
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-black/10 bg-paper/70 p-3">
                    <p className="font-medium" data-font-role="label">{report.title}</p>
                    <p className="mt-1 text-sm leading-6 text-black/65">{report.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeRightPanel === "favorites" ? (
            <section className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <select
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ember"
                onChange={(event) => setFavoriteCategory(event.target.value)}
                value={favoriteCategory}
              >
                <option value="随意">随意</option>
                <option value="重点">重点</option>
                <option value="想法">想法</option>
              </select>
              <textarea
                className="mt-3 min-h-24 w-full rounded-2xl border border-black/10 bg-paper/80 p-3 text-sm outline-none focus:border-ember"
                onChange={(event) => setFavoriteExcerpt(event.target.value)}
                placeholder="可粘贴复制的文段进行收藏..."
                value={favoriteExcerpt}
              />
              <button
                className="mt-3 w-full rounded-full border border-black/10 bg-paper px-4 py-2 text-sm disabled:opacity-60"
                disabled={isSavingFavorite || !activeDocument}
                onClick={handleSaveFavorite}
                type="button"
              >
                {isSavingFavorite ? "保存中..." : "收藏"}
              </button>
              </section>
          ) : null}

          {activeRightPanel === "favorites" ? (
            <section className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <button
                className="w-full rounded-full border border-[#d3d9ef] bg-[#f4f6fe] px-4 py-2 text-sm text-[#6f79a1] transition hover:bg-[#eceffd]"
                onClick={() => {
                  setIsFavoritesExpanded((current) => {
                    const next = !current;
                    if (!next) {
                      setExpandedFavoriteCategory("");
                      setExpandedFavoriteId("");
                    }
                    return next;
                  });
                }}
                type="button"
              >
                收藏夹
              </button>
              {isFavoritesExpanded ? (
                <div className="mt-4 space-y-3">
                  {Object.entries(favoriteGroups).map(([category, groupedFavorites]) => {
                    const isCategoryExpanded = expandedFavoriteCategory === category;

                    return (
                      <div key={category} className="rounded-2xl border border-black/10 bg-paper/70 p-3">
                        <button
                          className="flex w-full items-center justify-between text-left"
                          onClick={() =>
                            setExpandedFavoriteCategory((current) => (current === category ? "" : category))
                          }
                          type="button"
                        >
                          <p className="text-sm font-medium text-ink" data-font-role="label">{category}</p>
                          <span className="text-xs text-black/45">{groupedFavorites.length}</span>
                        </button>
                        {isCategoryExpanded ? (
                          <div className="mt-3 space-y-3">
                            {groupedFavorites.map((favorite) => {
                              const previewContent =
                                favorite.excerpt || favorite.messages[0]?.content || favorite.title;
                              const isExpanded = expandedFavoriteId === favorite.id;

                              return (
                                <div
                                  key={favorite.id}
                                  className="rounded-2xl bg-white/80 p-3 text-sm leading-6 text-black/70"
                                  onContextMenu={(event) => handleOpenFavoriteContextMenu(event, favorite.id)}
                                >
                                  <button
                                    className="w-full text-left"
                                    onClick={() =>
                                      setExpandedFavoriteId((current) => (current === favorite.id ? "" : favorite.id))
                                    }
                                    type="button"
                                  >
                                    <div className="rounded-2xl bg-white p-3 text-sm text-black/75">
                                      {isExpanded
                                        ? previewContent
                                        : `${previewContent.slice(0, 16)}${previewContent.length > 16 ? "..." : ""}`}
                                    </div>
                                  </button>
                                  <p className="mt-1 text-xs text-black/45">{favorite.createdAt.slice(0, 10)}</p>
                                  {favorite.sourceDocumentTitle ? (
                                    <p
                                      className={`mt-1 text-xs ${
                                        favorite.sourceDocumentDeleted ? "text-black/35" : "text-black/55"
                                      }`}
                                    >
                                      {favorite.sourceDocumentDeleted
                                        ? `${favorite.sourceDocumentTitle}（已删除）`
                                        : favorite.sourceDocumentTitle}
                                    </p>
                                  ) : null}
                                  {isExpanded ? (
                                    favorite.excerpt && favorite.messages.length ? (
                                      <div className="mt-2 space-y-2">
                                        {favorite.messages.map((message) => (
                                          <div
                                            key={message.id}
                                            className="rounded-2xl bg-[#f7f9fc] p-3 text-sm text-black/75"
                                          >
                                            {message.content}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeRightPanel === "compare" ? (
            <section className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <button
                className="w-full rounded-full border border-[#d3d9ef] bg-[#f4f6fe] px-4 py-2 text-sm text-[#6f79a1] transition hover:bg-[#eceffd]"
                onClick={() => setIsShowingCompareHistory((current) => !current)}
                type="button"
              >
                之前对比
              </button>
              {isShowingCompareHistory ? (
                <div className="mt-4 space-y-3 text-sm leading-6 text-black/70">
                  {compareHistory.length ? (
                    compareHistory.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-black/10 bg-paper/70 p-3"
                        onContextMenu={(event) => handleOpenCompareRecordContextMenu(event, record.id)}
                      >
                        <p className="text-xs tracking-[0.14em] text-black/45">
                          {record.generatedAt.slice(0, 10)}
                        </p>
                        <p className="mt-1 font-medium text-ink" data-font-role="label">
                          {record.documentTitles.join(" vs ")}
                        </p>
                        <div className="mt-3 space-y-2">
                          {record.insights.map((insight) => (
                            <div
                              key={`${record.id}-${insight.topic}`}
                              className="rounded-2xl bg-white/80 p-3"
                            >
                              <p className="font-medium text-ink" data-font-role="label">{insight.topic}</p>
                              <p className="mt-1">共识：{insight.consensus}</p>
                              <p className="mt-1">差异：{insight.difference}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-black/10 bg-paper/70 p-3 text-sm text-black/55">
                      暂无之前的对比记录。
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {!isNotesFloating ? notePanel : null}
          </div>
        </aside>
      </div>

      {isNotesFloating ? notePanel : null}

      {workspaceError ? (
        <div className="fixed bottom-4 right-4 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-sm">
          {workspaceError}
        </div>
      ) : null}

      {documentContextMenu ? (
        <div
          className="fixed z-50 min-w-32 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: documentContextMenu.x, top: documentContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#fdeceb] px-3 py-2 text-left text-sm text-[#c46b63] transition hover:bg-[#f9dfdc]"
            onClick={() => handleDeleteDocument(documentContextMenu.documentId)}
            type="button"
          >
            删除
          </button>
        </div>
      ) : null}

      {selectionContextMenu ? (
        <div
          className="fixed z-50 min-w-36 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: selectionContextMenu.x, top: selectionContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#f4ead8] px-3 py-2 text-left text-sm text-ink transition hover:bg-[#eadcc5]"
            onClick={handleSaveSelectionFavorite}
            type="button"
          >
            收藏
          </button>
        </div>
      ) : null}

      {favoriteContextMenu ? (
        <div
          className="fixed z-50 min-w-32 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: favoriteContextMenu.x, top: favoriteContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#fdeceb] px-3 py-2 text-left text-sm text-[#c46b63] transition hover:bg-[#f9dfdc]"
            onClick={() => handleDeleteFavorite(favoriteContextMenu.favoriteId)}
            type="button"
          >
            删除
          </button>
        </div>
      ) : null}

      {noteContextMenu ? (
        <div
          className="fixed z-50 min-w-32 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#fdeceb] px-3 py-2 text-left text-sm text-[#c46b63] transition hover:bg-[#f9dfdc]"
            onClick={() => handleDeleteNote(noteContextMenu.noteId)}
            type="button"
          >
            删除
          </button>
        </div>
      ) : null}

      {categoryContextMenu ? (
        <div
          className="fixed z-50 min-w-32 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: categoryContextMenu.x, top: categoryContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#fdeceb] px-3 py-2 text-left text-sm text-[#c46b63] transition hover:bg-[#f9dfdc]"
            onClick={() => handleDeleteCategory(categoryContextMenu.categoryId)}
            type="button"
          >
            删除
          </button>
        </div>
      ) : null}

      {compareRecordContextMenu ? (
        <div
          className="fixed z-50 min-w-32 rounded-2xl border border-black/10 bg-white p-2 shadow-lg"
          style={{ left: compareRecordContextMenu.x, top: compareRecordContextMenu.y }}
        >
          <button
            className="w-full rounded-xl bg-[#fdeceb] px-3 py-2 text-left text-sm text-[#c46b63] transition hover:bg-[#f9dfdc]"
            onClick={() => handleDeleteCompareRecord(compareRecordContextMenu.recordId)}
            type="button"
          >
            删除
          </button>
        </div>
      ) : null}
    </main>
  );
}


