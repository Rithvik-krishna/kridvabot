"use client";

import { useState } from "react";
import { ArrowLeft, GripVertical, Loader2, Plus, Sparkles, X } from "lucide-react";
import { resolveBackendUrl } from "@/lib/api";
import { PhotoGroup, UploadedImage } from "@/lib/types";

interface ReviewStepProps {
  images: UploadedImage[];
  groups: PhotoGroup[];
  onGroupsChange: (groups: PhotoGroup[]) => void;
  onBack: () => void;
  onGenerate: () => void;
  isStarting: boolean;
  error: string | null;
}

interface DragPayload {
  imageId: number;
  fromGroupId: string;
}

export function ReviewStep({
  images,
  groups,
  onGroupsChange,
  onBack,
  onGenerate,
  isStarting,
  error,
}: ReviewStepProps) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const imageMap = new Map<number, UploadedImage>(
    images.map((img) => [img.id, img])
  );

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
    } else {
      nextGroups = nextGroups.map((g) =>
        g.id === targetValue ? { ...g, image_ids: [...g.image_ids, imageId] } : g
      );
    }

    onGroupsChange(nextGroups.filter((g) => g.image_ids.length > 0));
  };

  const handleRemoveImage = (imageId: number, fromGroupId: string) => {
    const nextGroups = groups
      .map((g) =>
        g.id === fromGroupId
          ? { ...g, image_ids: g.image_ids.filter((id) => id !== imageId) }
          : g
      )
      .filter((g) => g.image_ids.length > 0);
    onGroupsChange(nextGroups);
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

  const pieceCount = groups.length;
  const totalImagesToGenerate = pieceCount * 2;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Review & Tweak Furniture Groups
          </h2>
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-900">
              {pieceCount} {pieceCount === 1 ? "piece" : "pieces"} ready
            </span>{" "}
            • Will generate{" "}
            <span className="font-medium text-stone-900">
              {totalImagesToGenerate} studio images
            </span>{" "}
            + Excel sheet •{" "}
            <span className="text-stone-500">
              Drag & drop photos between cards or use &ldquo;Move to...&rdquo;
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isStarting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={pieceCount === 0 || isStarting}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Catalog ZIP
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {pieceCount === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          All photos were removed. Go back to upload a new batch.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {groups.map((group, groupIndex) => {
            const isDropTarget =
              dragOverTarget === group.id &&
              dragging?.fromGroupId !== group.id;

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
                className={`rounded-2xl border p-5 shadow-xs transition-all ${
                  isDropTarget
                    ? "border-stone-900 bg-stone-100/90 ring-2 ring-stone-900/20"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-stone-900">
                    Piece #{groupIndex + 1}
                  </h3>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    {group.image_ids.length}{" "}
                    {group.image_ids.length === 1 ? "photo" : "photos"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {group.image_ids.map((imgId) => {
                    const img = imageMap.get(imgId);
                    if (!img) return null;

                    const isBeingDragged =
                      dragging?.imageId === imgId &&
                      dragging?.fromGroupId === group.id;

                    return (
                      <div
                        key={imgId}
                        draggable
                        onDragStart={(e) => {
                          const payload: DragPayload = {
                            imageId: imgId,
                            fromGroupId: group.id,
                          };
                          setDragging(payload);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify(payload)
                          );
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOverTarget(null);
                        }}
                        className={`group relative flex cursor-grab flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-50 active:cursor-grabbing ${
                          isBeingDragged ? "opacity-40 ring-2 ring-stone-400" : ""
                        }`}
                      >
                        <div className="relative aspect-square w-full bg-stone-100">
                          <img
                            src={resolveBackendUrl(img.thumb_url)}
                            alt={img.filename}
                            draggable={false}
                            className="h-full w-full object-cover select-none"
                          />
                          <div
                            title="Drag to move to another group"
                            className="absolute top-1.5 left-1.5 rounded-full bg-stone-900/65 p-1 text-white opacity-85"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(imgId, group.id)}
                            title="Remove photo"
                            aria-label={`Remove ${img.filename}`}
                            className="absolute top-1.5 right-1.5 rounded-full bg-stone-900/75 p-1 text-white opacity-90 transition hover:bg-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="p-2">
                          <p
                            className="mb-1.5 truncate text-[11px] font-medium text-stone-600"
                            title={img.filename}
                          >
                            {img.filename}
                          </p>
                          <select
                            aria-label={`Move ${img.filename} to another group`}
                            value=""
                            onChange={(e) =>
                              handleMoveImage(imgId, group.id, e.target.value)
                            }
                            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 focus:border-stone-800 focus:outline-none"
                          >
                            <option value="" disabled>
                              Move to...
                            </option>
                            {groups.map((targetGroup, targetIdx) =>
                              targetGroup.id === group.id ? null : (
                                <option
                                  key={targetGroup.id}
                                  value={targetGroup.id}
                                >
                                  Piece #{targetIdx + 1}
                                </option>
                              )
                            )}
                            <option value="__NEW_GROUP__">
                              + Create New Group
                            </option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Dropzone card to create a brand new group via drag & drop */}
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
            className={`flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dragOverTarget === "__NEW_GROUP__"
                ? "border-stone-900 bg-stone-100 text-stone-900 ring-2 ring-stone-900/20"
                : dragging
                  ? "border-stone-400 bg-stone-50 text-stone-700"
                  : "border-stone-200 bg-stone-50/50 text-stone-400"
            }`}
          >
            <Plus className="mb-2 h-6 w-6" />
            <p className="text-sm font-medium">
              Drop a photo here to create a new group
            </p>
            <p className="mt-1 text-xs">
              Splits a misgrouped photo into its own furniture piece
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
