/* eslint-disable @next/next/no-img-element */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileImage,
  ImagePlus,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Save,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, ImageMarkupModal } from "@/ui_engine";
import { cn } from "@/lib/utils";
import { compressImage, getCroppedImg } from "@/lib/utils/image-utils";
import { unwrapActionResult } from "@/lib/result";
import { useAppConfirm } from "@/hooks/use-app-confirm";
import {
  createMomItem,
  createMomPoint,
  deleteMomImage,
  deleteMomItem,
  deleteMomPoint,
  reorderMomImages,
  reorderMomItems,
  reorderMomPoints,
  updateMomDocument,
  updateMomItem,
  updateMomPoint,
  upsertMomImage,
} from "../actions/mom-actions";

type MomListStyle = "decimal" | "disc" | "dash" | "none";
type MomPointStyle = "default" | "none";

type EditorDocument = {
  id: string;
  mom_topic: string;
  mom_date: string;
  mom_venue: string | null;
  mom_attendees: string | null;
  mom_prepared_by_name: string;
  mom_items: {
    id: string;
    sort_order: number;
    is_text_only: boolean;
    list_style: MomListStyle;
    mom_points: {
      id: string;
      sort_order: number;
      text: string;
      style: MomPointStyle;
    }[];
    mom_images: {
      id: string;
      sort_order: number;
      file_url: string;
    }[];
  }[];
};

interface MomEditorProps {
  projectId: string;
  projectName: string;
  clientName: string | null;
  document: EditorDocument;
}

interface CropState {
  momItemId: string;
  sortOrder: number;
  src: string;
  filename: string;
}

const LIST_STYLE_OPTIONS: { value: MomListStyle; label: string }[] = [
  { value: "decimal", label: "1. 2. 3." },
  { value: "disc", label: "Bullet" },
  { value: "dash", label: "Dash" },
  { value: "none", label: "Plain" },
];

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function displayPointPrefix(listStyle: MomListStyle, index: number) {
  switch (listStyle) {
    case "disc":
      return "•";
    case "dash":
      return "-";
    case "none":
      return "";
    default:
      return `${index + 1}.`;
  }
}

export function MomEditor({ projectId, projectName, clientName, document }: MomEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [docState, setDocState] = React.useState(document);
  const [headerDraft, setHeaderDraft] = React.useState({
    mom_topic: document.mom_topic,
    mom_date: document.mom_date.slice(0, 10),
    mom_venue: document.mom_venue ?? "",
    mom_attendees: document.mom_attendees ?? "",
    mom_prepared_by_name: document.mom_prepared_by_name,
  });
  const [cropState, setCropState] = React.useState<CropState | null>(null);
  const [markupState, setMarkupState] = React.useState<{
    momItemId: string;
    sortOrder: number;
    imageSrc: string;
  } | null>(null);
  const [cropPoint, setCropPoint] = React.useState<Point>({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const appConfirm = useAppConfirm();

  React.useEffect(() => {
    setDocState(document);
    setHeaderDraft({
      mom_topic: document.mom_topic,
      mom_date: document.mom_date.slice(0, 10),
      mom_venue: document.mom_venue ?? "",
      mom_attendees: document.mom_attendees ?? "",
      mom_prepared_by_name: document.mom_prepared_by_name,
    });
  }, [document]);

  const uploadMomImage = React.useCallback(
    async (file: File, momItemId: string, sortOrder: number) => {
      const compressed = await compressImage(file);
      const uploadFile = compressed instanceof File ? compressed : new File([compressed], file.name, { type: file.type || "image/jpeg" });
      const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
      const path = `${projectId}/mom/${docState.id}/${safeName}`;
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("folder", "projects");
      formData.append("path", path);

      const response = await fetch("/api/upload/media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image.");
      }

      const { url } = (await response.json()) as { url: string };
      unwrapActionResult(
        await upsertMomImage({
          projectId,
          mom_item_id: momItemId,
          sort_order: sortOrder,
          file_url: url,
        })
      );
      router.refresh();
    },
    [docState.id, projectId, router]
  );

  const handleSaveHeader = () => {
    startTransition(async () => {
      try {
        unwrapActionResult(
          await updateMomDocument({
            projectId,
            mom_document_id: docState.id,
            mom_topic: headerDraft.mom_topic,
            mom_date: new Date(headerDraft.mom_date),
            mom_venue: headerDraft.mom_venue || null,
            mom_attendees: headerDraft.mom_attendees || null,
            mom_prepared_by_name: headerDraft.mom_prepared_by_name,
          })
        );
        toast.success("MOM header saved.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save MOM header.");
      }
    });
  };

  const moveItem = (itemId: string, direction: "up" | "down") => {
    const currentIndex = docState.mom_items.findIndex((item) => item.id === itemId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= docState.mom_items.length) return;

    const nextItems = [...docState.mom_items];
    [nextItems[currentIndex], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[currentIndex]];
    setDocState((prev) => ({ ...prev, mom_items: nextItems }));

    startTransition(async () => {
      try {
        unwrapActionResult(
          await reorderMomItems({
            projectId,
            mom_document_id: docState.id,
            mom_item_ids: nextItems.map((item) => item.id),
          })
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to reorder sections.");
        router.refresh();
      }
    });
  };

  const movePoint = (momItemId: string, pointId: string, direction: "up" | "down") => {
    const item = docState.mom_items.find((entry) => entry.id === momItemId);
    if (!item) return;
    const currentIndex = item.mom_points.findIndex((point) => point.id === pointId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= item.mom_points.length) return;

    const nextPoints = [...item.mom_points];
    [nextPoints[currentIndex], nextPoints[targetIndex]] = [nextPoints[targetIndex], nextPoints[currentIndex]];
    setDocState((prev) => ({
      ...prev,
      mom_items: prev.mom_items.map((entry) =>
        entry.id === momItemId ? { ...entry, mom_points: nextPoints } : entry
      ),
    }));

    startTransition(async () => {
      try {
        unwrapActionResult(
          await reorderMomPoints({
            projectId,
            mom_item_id: momItemId,
            mom_point_ids: nextPoints.map((point) => point.id),
          })
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to reorder points.");
        router.refresh();
      }
    });
  };

  const addSection = () => {
    startTransition(async () => {
      try {
        unwrapActionResult(await createMomItem({ projectId, mom_document_id: docState.id }));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add section.");
      }
    });
  };

  const addPoint = (momItemId: string) => {
    startTransition(async () => {
      try {
        unwrapActionResult(await createMomPoint({ projectId, mom_item_id: momItemId, text: "" }));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add point.");
      }
    });
  };

  const commitPoint = (pointId: string, text: string, style: MomPointStyle) => {
    startTransition(async () => {
      try {
        unwrapActionResult(await updateMomPoint({ projectId, mom_point_id: pointId, text, style }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save point.");
        router.refresh();
      }
    });
  };

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>, momItemId: string, sortOrder: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropState({
        momItemId,
        sortOrder,
        src: reader.result as string,
        filename: file.name,
      });
      setCropPoint({ x: 0, y: 0 });
      setCropZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleCropComplete = React.useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const finalizeCropUpload = () => {
    if (!cropState || !croppedAreaPixels) return;

    startTransition(async () => {
      try {
        const croppedBlob = await getCroppedImg(cropState.src, croppedAreaPixels);
        if (!croppedBlob) throw new Error("Failed to crop image.");
        const file = new File([croppedBlob], cropState.filename, { type: "image/jpeg" });
        await uploadMomImage(file, cropState.momItemId, cropState.sortOrder);
        setCropState(null);
        toast.success("Image saved to MOM.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload image.");
      }
    });
  };

  const finalizeAnnotatedUpload = (file: File) => {
    if (!markupState) return;
    startTransition(async () => {
      try {
        await uploadMomImage(file, markupState.momItemId, markupState.sortOrder);
        setMarkupState(null);
        toast.success("Annotated image saved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save annotation.");
      }
    });
  };

  return (
    <div className="space-y-[var(--ui-section-gap)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Project MOM Editor</p>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-slate-950">{projectName}</h2>
          <p className="font-sans text-sm text-slate-500">{clientName || "No client assigned"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/mom/${docState.id}/print`}>
              <Printer className="h-3.5 w-3.5" />
              Print View
            </Link>
          </Button>
          <Button type="button" onClick={handleSaveHeader} size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Header
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl font-bold">Document Header</CardTitle>
          <CardDescription>Project identity is derived from StudioFlow and cannot be edited here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Project</label>
            <Input value={projectName} disabled className="bg-slate-50" />
          </div>
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Prepared By</label>
            <Input
              value={headerDraft.mom_prepared_by_name}
              onChange={(event) => setHeaderDraft((prev) => ({ ...prev, mom_prepared_by_name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Topic</label>
            <Input
              value={headerDraft.mom_topic}
              onChange={(event) => setHeaderDraft((prev) => ({ ...prev, mom_topic: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Date</label>
            <Input
              type="date"
              value={headerDraft.mom_date}
              onChange={(event) => setHeaderDraft((prev) => ({ ...prev, mom_date: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Venue</label>
            <Input
              value={headerDraft.mom_venue}
              onChange={(event) => setHeaderDraft((prev) => ({ ...prev, mom_venue: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Attendees</label>
            <Input
              value={headerDraft.mom_attendees}
              onChange={(event) => setHeaderDraft((prev) => ({ ...prev, mom_attendees: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Sections</p>
          <h3 className="font-serif text-xl font-bold text-slate-950">Photo Notes & Observations</h3>
        </div>
        <Button type="button" size="sm" onClick={addSection} disabled={isPending}>
          <Plus className="h-3.5 w-3.5" />
          Add Section
        </Button>
      </div>

      <div className="space-y-4">
        {docState.mom_items.map((item, itemIndex) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-2">
                <CardTitle className="font-serif text-lg font-bold">Section {itemIndex + 1}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={item.is_text_only ? "default" : "outline"}
                    size="xs"
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          unwrapActionResult(
                            await updateMomItem({
                              projectId,
                              mom_item_id: item.id,
                              is_text_only: !item.is_text_only,
                              list_style: item.list_style,
                            })
                          );
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Failed to update section.");
                        }
                      })
                    }
                  >
                    <TextCursorInput className="h-3 w-3" />
                    Text Only
                  </Button>
                  <select
                    value={item.list_style}
                    onChange={(event) =>
                      startTransition(async () => {
                        try {
                          unwrapActionResult(
                            await updateMomItem({
                              projectId,
                              mom_item_id: item.id,
                              is_text_only: item.is_text_only,
                              list_style: event.target.value as MomListStyle,
                            })
                          );
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Failed to update list style.");
                        }
                      })
                    }
                    className="h-6 rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-2 font-sans text-xs text-slate-700"
                  >
                    {LIST_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon-xs" onClick={() => moveItem(item.id, "up")} disabled={itemIndex === 0 || isPending}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button type="button" variant="outline" size="icon-xs" onClick={() => moveItem(item.id, "down")} disabled={itemIndex === docState.mom_items.length - 1 || isPending}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={async () => {
                    if (!(await appConfirm.confirm({
                      title: "Delete this MOM section?",
                      description: "The section, its notes, and its attached images will be permanently deleted.",
                      confirmLabel: "Delete section",
                    }))) return;
                    startTransition(async () => {
                      try {
                        unwrapActionResult(await deleteMomItem({ projectId, mom_item_id: item.id }));
                        router.refresh();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to delete section.");
                      }
                    });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className={cn("grid gap-4", item.is_text_only ? "grid-cols-1" : "lg:grid-cols-[minmax(0,18rem)_1fr]")}>
              {!item.is_text_only && (
                <div className="space-y-3">
                  {[0, 1].map((slot) => {
                    const image = item.mom_images.find((entry) => entry.sort_order === slot);
                    return (
                      <div key={slot} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Image {slot + 1}</p>
                          {image && (
                            <div className="flex items-center gap-1">
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50">
                                <ImageUp className="h-3 w-3" />
                                Replace
                                <input type="file" className="hidden" accept="image/*" onChange={(event) => handlePickImage(event, item.id, slot)} />
                              </label>
                              <Button type="button" variant="outline" size="xs" onClick={() => setMarkupState({ momItemId: item.id, sortOrder: slot, imageSrc: image.file_url })}>
                                <Pencil className="h-3 w-3" />
                                Annotate
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  startTransition(async () => {
                                    try {
                                      unwrapActionResult(await deleteMomImage({ projectId, mom_image_id: image.id }));
                                      router.refresh();
                                    } catch (error) {
                                      toast.error(error instanceof Error ? error.message : "Failed to delete image.");
                                    }
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {image ? (
                          <div className="overflow-hidden rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-slate-200 bg-slate-50">
                            <img src={image.file_url} alt={`MOM section ${itemIndex + 1} visual ${slot + 1}`} className="h-auto w-full object-cover" />
                          </div>
                        ) : (
                          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:bg-white hover:text-slate-700">
                            <ImagePlus className="h-5 w-5" />
                            <span className="font-sans text-xs font-medium">Upload Image</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(event) => handlePickImage(event, item.id, slot)} />
                          </label>
                        )}
                      </div>
                    );
                  })}

                  {item.mom_images.length === 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            const reordered = [...item.mom_images].sort((a, b) => a.sort_order - b.sort_order).reverse();
                            unwrapActionResult(
                              await reorderMomImages({
                                projectId,
                                mom_item_id: item.id,
                                mom_image_ids: reordered.map((image) => image.id),
                              })
                            );
                            router.refresh();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to swap image order.");
                          }
                        })
                      }
                    >
                      <FileImage className="h-3.5 w-3.5" />
                      Swap Image Order
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {item.mom_points.map((point, pointIndex) => (
                  <div key={point.id} className="rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-[var(--ui-border-subtle,rgb(241_245_249))] bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.list_style !== "none" && (
                          <span className="font-sans text-xs font-bold text-slate-500">{displayPointPrefix(item.list_style, pointIndex)}</span>
                        )}
                        <select
                          value={point.style}
                          onChange={(event) => {
                            const nextStyle = event.target.value as MomPointStyle;
                            setDocState((prev) => ({
                              ...prev,
                              mom_items: prev.mom_items.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      mom_points: entry.mom_points.map((entryPoint) =>
                                        entryPoint.id === point.id ? { ...entryPoint, style: nextStyle } : entryPoint
                                      ),
                                    }
                                  : entry
                              ),
                            }));
                            commitPoint(point.id, point.text, nextStyle);
                          }}
                          className="h-6 rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"
                        >
                          <option value="default">Default</option>
                          <option value="none">Plain</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon-xs" onClick={() => movePoint(item.id, point.id, "up")} disabled={pointIndex === 0 || isPending}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="outline" size="icon-xs" onClick={() => movePoint(item.id, point.id, "down")} disabled={pointIndex === item.mom_points.length - 1 || isPending}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                unwrapActionResult(await deleteMomPoint({ projectId, mom_point_id: point.id }));
                                router.refresh();
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Failed to delete point.");
                              }
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <textarea
                      value={point.text}
                      onChange={(event) =>
                        setDocState((prev) => ({
                          ...prev,
                          mom_items: prev.mom_items.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  mom_points: entry.mom_points.map((entryPoint) =>
                                    entryPoint.id === point.id ? { ...entryPoint, text: event.target.value } : entryPoint
                                  ),
                                }
                              : entry
                          ),
                        }))
                      }
                      onBlur={(event) => commitPoint(point.id, event.target.value, point.style)}
                      rows={3}
                      className="w-full resize-y rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-3 py-2 font-sans text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                      placeholder="Describe the observation..."
                    />
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={() => addPoint(item.id)} disabled={isPending}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Point
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={cropState !== null} onOpenChange={(open) => !open && setCropState(null)}>
        <DialogContent size="lg" showCloseButton={false} className="p-0 overflow-hidden">
          <DialogHeader className="border-b border-[var(--ui-border-subtle,rgb(241_245_249))] p-6">
            <DialogTitle className="font-serif text-xl font-bold">Crop MOM Image</DialogTitle>
          </DialogHeader>
          <div className="relative h-[420px] bg-slate-100">
            {cropState && (
              <Cropper
                image={cropState.src}
                crop={cropPoint}
                zoom={cropZoom}
                aspect={4 / 3}
                onCropChange={setCropPoint}
                onZoomChange={setCropZoom}
                onCropComplete={handleCropComplete}
              />
            )}
          </div>
          <DialogFooter className="flex items-center justify-between px-6">
            <div className="flex flex-1 items-center gap-3">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="flex-1 accent-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setCropState(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={finalizeCropUpload} disabled={!cropState || isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Image
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {markupState && (
        <ImageMarkupModal
          imageSrc={markupState.imageSrc}
          onClose={() => setMarkupState(null)}
          onSave={finalizeAnnotatedUpload}
          title="Annotate MOM Image"
          confirmLabel="Save Annotation"
        />
      )}
      {appConfirm.dialog}
    </div>
  );
}
