"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { resolveBackendUrl } from "@/lib/api";
import { PhotoGroup, UploadedImage } from "@/lib/types";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ToastTone } from "./ui/Toast";

interface ReviewStepProps {
  images: UploadedImage[];
  groups: PhotoGroup[];
  onGroupsChange: (groups: PhotoGroup[]) => void;
  onBack: () => void;
  onGenerate: () => void;
  isStarting: boolean;
  error: string | null;
  onNotify?: (opts: {
    message: string;
    tone: ToastTone;
    actionLabel?: string;
    onAction?: () => void;
  }) => void;
}

interface DragPayload {
  imageId: number;
  fromGroupId: string;
}

interface LightboxState {
  groupId: string;
  imageId: number;
}

interface MenuState {
  groupId: string;
  imageId: number;
}

export function ReviewStep({
  images,
  groups,
  onGroupsChange,
  onBack,
  onGenerate,
  isStarting,
  error,
  onNotify,
}: ReviewStepProps) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [pieceTitles, setPieceTitles] = useState<Record<string, string>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [openMenu, setOpenMenu] = useState<MenuState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [pendingLastRemoval, setPendingLastRemoval] = useState<{
    imageId: number;
    groupId: string;
  } | null>(null);

  const imageMap = useMemo(
    () => new Map<number, UploadedImage>(images.map((img) => [img.id, img])),
    [images]
  );

  const getGroupLabel = (group: PhotoGroup, index: number) =>
    pieceTitles[group.id]?.trim() || `Piece #${index + 1}`;

  // Close photo menu on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    const handleClick = () => setOpenMenu(null);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleClick);
    };
  }, [openMenu]);

  // Lightbox keyboard navigation (Left/Right/Escape)
  const lightboxImages = useMemo(() => {
    if (!lightbox) return [];
    const group = groups.find((g) => g.id === lightbox.groupId);
    if (!group) return [];
    return group.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is UploadedImage => Boolean(img));
  }, [lightbox, groups, imageMap]);

  useEffect(() => {
    if (!lightbox || lightboxImages.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
      } else if (e.key === "ArrowRight") {
        const idx = lightboxImages.findIndex((i) => i.id === lightbox.imageId);
        const next = lightboxImages[(idx + 1) % lightboxImages.length];
        if (next) setLightbox({ groupId: lightbox.groupId, imageId: next.id });
      } else if (e.key === "ArrowLeft") {
        const idx = lightboxImages.findIndex((i) => i.id === lightbox.imageId);
        const prev =
          lightboxImages[
            (idx - 1 + lightboxImages.length) % lightboxImages.length
          ];
        if (prev) setLightbox({ groupId: lightbox.groupId, imageId: prev.id });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox, lightboxImages]);

  const handleMoveImage = (
    imageId: number,
    fromGroupId: string,
    targetValue: string
  ) => {
    if (!targetValue || targetValue === fromGroupId) return;

    let nextGroups = groups.map((g) =>
      g.id === fromGroupId
        ? { ...g, image_ids: g.image_ids.filter((id) => id !== imageId) }
        : g
    );

    if (targetValue === "__NEW_GROUP__") {
      const newGroupId = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      nextGroups.push({ id: newGroupId, image_ids: [imageId] });
      onNotify?.({ message: "Created new piece group", tone: "info" });
    } else {
      nextGroups = nextGroups.map((g) =>
        g.id === targetValue ? { ...g, image_ids: [...g.image_ids, imageId] } : g
      );
      const targetIdx = nextGroups.findIndex((g) => g.id === targetValue);
      const targetLabel =
        targetIdx >= 0 ? getGroupLabel(nextGroups[targetIdx], targetIdx) : "piece";
      onNotify?.({ message: `Moved photo to ${targetLabel}`, tone: "info" });
    }

    onGroupsChange(nextGroups.filter((g) => g.image_ids.length > 0));
    setOpenMenu(null);
  };

  const executeRemoveImage = (imageId: number, fromGroupId: string) => {
    const snapshot = groups.map((g) => ({ ...g, image_ids: [...g.image_ids] }));
    const nextGroups = groups
      .map((g) =>
        g.id === fromGroupId
          ? { ...g, image_ids: g.image_ids.filter((id) => id !== imageId) }
          : g
      )
      .filter((g) => g.image_ids.length > 0);
    onGroupsChange(nextGroups);
    setOpenMenu(null);

    onNotify?.({
      message: "Photo removed",
      tone: "info",
      actionLabel: "Undo",
      onAction: () => onGroupsChange(snapshot),
    });
  };

  const requestRemoveImage = (imageId: number, fromGroupId: string) => {
    const group = groups.find((g) => g.id === fromGroupId);
    if (group && group.image_ids.length === 1) {
      setOpenMenu(null);
      setPendingLastRemoval({ imageId, groupId: fromGroupId });
      return;
    }
    executeRemoveImage(imageId, fromGroupId);
  };

  const handleDropOnTarget = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    setDragOverTarget(null);

    let payload = dragging;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) payload = JSON.parse(raw) as DragPayload;
      } catch {
        // ignore invalid drag data
      }
    }

    if (payload) {
      handleMoveImage(payload.imageId, payload.fromGroupId, targetGroupId);
    }
    setDragging(null);
  };

  const commitRename = (groupId: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      setPieceTitles((prev) => ({ ...prev, [groupId]: trimmed }));
    }
    setEditingGroupId(null);
  };

  const pieceCount = groups.length;
  const totalPhotos = groups.reduce((acc, g) => acc + g.image_ids.length, 0);
  const totalImagesToGenerate = pieceCount * 2;

  const renderPhotoCard = (
    img: UploadedImage,
    group: PhotoGroup,
    groupIndex: number,
    isCover: boolean
  ) => {
    const isBeingDragged =
      dragging?.imageId === img.id && dragging?.fromGroupId === group.id;
    const isMenuOpen =
      openMenu?.groupId === group.id && openMenu?.imageId === img.id;

    return (
      <div
        key={img.id}
        draggable
        onDragStart={(e) => {
          const payload: DragPayload = {
            imageId: img.id,
            fromGroupId: group.id,
          };
          setDragging(payload);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/json", JSON.stringify(payload));
        }}
        onDragEnd={() => {
          setDragging(null);
          setDragOverTarget(null);
        }}
        title={img.filename}
        className={`group relative flex cursor-grab flex-col rounded-xl border bg-stone-100 active:cursor-grabbing ${
          isBeingDragged
            ? "scale-[0.98] border-dashed border-stone-500 opacity-45 ring-2 ring-stone-400"
            : "border-stone-200 hover:border-stone-300"
        } ${isCover ? "aspect-[16/10] w-full" : "aspect-square w-full"}`}
      >
        <button
          type="button"
          onClick={() => setLightbox({ groupId: group.id, imageId: img.id })}
          aria-label={`Zoom ${img.filename}`}
          className="relative h-full w-full overflow-hidden rounded-xl focus:outline-none"
        >
          <img
            src={resolveBackendUrl(img.thumb_url)}
            alt={img.filename}
            draggable={false}
            className="h-full w-full object-cover select-none"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 opacity-0 transition group-hover:bg-stone-950/15 group-hover:opacity-100">
            <span className="rounded-full bg-white/90 p-1.5 text-stone-900 shadow-sm">
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
        </button>

        {/* Visible grip handle */}
        <div
          title="Drag to move to another piece"
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-2 rounded-full bg-stone-900/70 p-1 text-white"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* "..." action menu button */}
        <div
          className="absolute top-2 right-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Actions for ${img.filename}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() =>
              setOpenMenu(
                isMenuOpen ? null : { groupId: group.id, imageId: img.id }
              )
            }
            className="rounded-full bg-stone-900/75 p-1.5 text-white shadow-xs hover:bg-stone-900"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1.5 w-48 rounded-xl border border-stone-200 bg-white py-1.5 text-xs shadow-xl"
            >
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Move to piece...
              </div>
              <div className="max-h-40 overflow-y-auto">
                {groups.map((targetGroup, targetIdx) =>
                  targetGroup.id === group.id ? null : (
                    <button
                      key={targetGroup.id}
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleMoveImage(img.id, group.id, targetGroup.id)
                      }
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-stone-700 hover:bg-stone-100"
                    >
                      <span className="truncate">
                        {getGroupLabel(targetGroup, targetIdx)}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {targetGroup.image_ids.length}
                      </span>
                    </button>
                  )
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    handleMoveImage(img.id, group.id, "__NEW_GROUP__")
                  }
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-medium text-stone-800 hover:bg-stone-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>New piece</span>
                </button>
              </div>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => requestRemoveImage(img.id, group.id)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeLightboxImg = lightbox ? imageMap.get(lightbox.imageId) : null;
  const activeLightboxIdx = lightbox
    ? lightboxImages.findIndex((i) => i.id === lightbox.imageId)
    : -1;

  return (
    <div className="space-y-6">
      {/* Sticky Summary Bar */}
      <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/95 p-5 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Review & Tweak Furniture Groups
          </h2>
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-900">
              {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
            </span>{" "}
            • {totalPhotos} {totalPhotos === 1 ? "photo" : "photos"} •{" "}
            <span className="font-medium text-stone-900">
              {totalImagesToGenerate} images
            </span>{" "}
            will be generated
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={onBack} disabled={isStarting}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={pieceCount === 0}
            isLoading={isStarting}
            loadingText="Starting..."
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Generate Catalog ZIP
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {pieceCount === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-stone-700">
            No furniture pieces remaining.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Go back to upload a new batch of workshop photos.
          </p>
          <Button variant="secondary" className="mt-4" onClick={onBack}>
            Back to Upload
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {groups.map((group, groupIndex) => {
            const isDropTarget =
              dragOverTarget === group.id &&
              dragging?.fromGroupId !== group.id;
            const photoCount = group.image_ids.length;
            const showAngleWarning = photoCount === 1 || photoCount > 3;
            const coverImg = imageMap.get(group.image_ids[0]);
            const extraImgs = group.image_ids
              .slice(1)
              .map((id) => imageMap.get(id))
              .filter((img): img is UploadedImage => Boolean(img));
            const label = getGroupLabel(group, groupIndex);

            return (
              <div
                key={group.id}
                onDragOver={(e) => {
                  if (dragging && dragging.fromGroupId !== group.id) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverTarget !== group.id) {
                      setDragOverTarget(group.id);
                    }
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverTarget(null);
                  }
                }}
                onDrop={(e) => handleDropOnTarget(e, group.id)}
                className={`rounded-2xl border p-5 shadow-xs ${
                  isDropTarget
                    ? "border-stone-900 bg-stone-100/90 ring-2 ring-stone-900/20"
                    : "border-stone-200 bg-white"
                }`}
              >
                {/* Card Header with editable title + count/warning badges */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  {editingGroupId === group.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitRename(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(group.id);
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                      aria-label="Rename furniture piece"
                      className="w-48 rounded-lg border border-stone-400 bg-stone-50 px-2.5 py-1 text-sm font-semibold text-stone-900 focus:border-stone-900 focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setDraftTitle(label);
                      }}
                      title="Click to rename piece"
                      className="group/title inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left text-base font-semibold text-stone-900 hover:bg-stone-100"
                    >
                      <span>{label}</span>
                      <Pencil
                        className="h-3.5 w-3.5 text-stone-400 opacity-0 group-hover/title:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {showAngleWarning && (
                      <span
                        title="Best results with 1-3 clear angles."
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        <span>
                          {photoCount === 1 ? "1 angle" : `${photoCount} angles`}
                        </span>
                      </span>
                    )}
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                      {photoCount} {photoCount === 1 ? "photo" : "photos"}
                    </span>
                  </div>
                </div>

                {/* Cover photo + smaller thumbnails below */}
                <div className="space-y-3">
                  {coverImg && renderPhotoCard(coverImg, group, groupIndex, true)}

                  {extraImgs.length > 0 && (
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {extraImgs.map((img) =>
                        renderPhotoCard(img, group, groupIndex, false)
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Dropzone card to create a new group by dragging a photo */}
          <div
            onDragOver={(e) => {
              if (dragging) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverTarget !== "__NEW_GROUP__") {
                  setDragOverTarget("__NEW_GROUP__");
                }
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverTarget(null);
              }
            }}
            onDrop={(e) => handleDropOnTarget(e, "__NEW_GROUP__")}
            className={`flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center ${
              dragOverTarget === "__NEW_GROUP__"
                ? "border-stone-900 bg-stone-100 text-stone-900 ring-2 ring-stone-900/20"
                : dragging
                  ? "border-stone-400 bg-stone-50 text-stone-700"
                  : "border-stone-200 bg-stone-50/50 text-stone-500"
            }`}
          >
            <Plus className="mb-2 h-6 w-6" aria-hidden="true" />
            <p className="text-sm font-medium">
              + New piece — drop a photo here
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Splits a misgrouped photo into its own furniture piece
            </p>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox && activeLightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image preview: ${activeLightboxImg.filename}`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-4xl flex-col items-center"
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close image preview"
              className="absolute -top-11 right-0 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="relative flex items-center justify-center">
              {lightboxImages.length > 1 && (
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => {
                    const prev =
                      lightboxImages[
                        (activeLightboxIdx - 1 + lightboxImages.length) %
                          lightboxImages.length
                      ];
                    if (prev)
                      setLightbox({ groupId: lightbox.groupId, imageId: prev.id });
                  }}
                  className="mr-3 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              )}

              <img
                src={resolveBackendUrl(activeLightboxImg.thumb_url)}
                alt={activeLightboxImg.filename}
                className="max-h-[78vh] max-w-[80vw] rounded-xl object-contain shadow-2xl"
              />

              {lightboxImages.length > 1 && (
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => {
                    const next =
                      lightboxImages[
                        (activeLightboxIdx + 1) % lightboxImages.length
                      ];
                    if (next)
                      setLightbox({ groupId: lightbox.groupId, imageId: next.id });
                  }}
                  className="ml-3 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-stone-300">
              {activeLightboxImg.filename} •{" "}
              {activeLightboxIdx + 1} of {lightboxImages.length} • Press Esc to close
            </p>
          </div>
        </div>
      )}

      {/* Confirmation dialog when removing the last photo in a piece */}
      <ConfirmDialog
        open={Boolean(pendingLastRemoval)}
        title="Remove last photo in this piece?"
        description="This is the only photo in this group. Removing it will delete the entire piece from this batch."
        confirmLabel="Remove piece"
        cancelLabel="Keep photo"
        destructive
        onCancel={() => setPendingLastRemoval(null)}
        onConfirm={() => {
          if (pendingLastRemoval) {
            executeRemoveImage(
              pendingLastRemoval.imageId,
              pendingLastRemoval.groupId
            );
            setPendingLastRemoval(null);
          }
        }}
      />
    </div>
  );
}
