"use client";

import { useActionState, useRef, useState } from "react";
import type { ProfileContentData } from "@/lib/profile-content";
import { updateProfile, uploadAvatar, resyncNow, logout } from "./actions";

type FeaturedItem = { title: string; description: string; url: string };
const MAX_FEATURED_ITEMS = 6;
const EMPTY_ITEM: FeaturedItem = { title: "", description: "", url: "" };

type PlatformLink = { name: string; logoUrl: string; url: string };
const MAX_PLATFORM_LINKS = 8;
const EMPTY_PLATFORM_LINK: PlatformLink = { name: "", logoUrl: "", url: "" };

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Crop editor: CONTAINER_SIZE is the on-screen preview circle (CSS px),
// OUTPUT_SIZE is the resolution of the square PNG actually uploaded.
const CROP_CONTAINER_SIZE = 220;
const CROP_OUTPUT_SIZE = 512;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function AvatarCropper({
  imageSrc,
  onCancel,
  onSave,
}: {
  imageSrc: string;
  onCancel: () => void;
  onSave: (file: File) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const baseScale = naturalSize
    ? Math.max(
        CROP_CONTAINER_SIZE / naturalSize.w,
        CROP_CONTAINER_SIZE / naturalSize.h,
      )
    : 1;
  const totalScale = baseScale * zoom;
  const displayedWidth = (naturalSize?.w ?? CROP_CONTAINER_SIZE) * totalScale;
  const displayedHeight = (naturalSize?.h ?? CROP_CONTAINER_SIZE) * totalScale;
  const maxOffsetX = Math.max(0, (displayedWidth - CROP_CONTAINER_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayedHeight - CROP_CONTAINER_SIZE) / 2);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const nextX = e.clientX - dragStart.current.x;
    const nextY = e.clientY - dragStart.current.y;
    setOffset({
      x: clamp(nextX, -maxOffsetX, maxOffsetX),
      y: clamp(nextY, -maxOffsetY, maxOffsetY),
    });
  }

  function handlePointerUp() {
    dragStart.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    const nextTotalScale = baseScale * nextZoom;
    const nextWidth = (naturalSize?.w ?? CROP_CONTAINER_SIZE) * nextTotalScale;
    const nextHeight = (naturalSize?.h ?? CROP_CONTAINER_SIZE) * nextTotalScale;
    const nextMaxX = Math.max(0, (nextWidth - CROP_CONTAINER_SIZE) / 2);
    const nextMaxY = Math.max(0, (nextHeight - CROP_CONTAINER_SIZE) / 2);
    setOffset((prev) => ({
      x: clamp(prev.x, -nextMaxX, nextMaxX),
      y: clamp(prev.y, -nextMaxY, nextMaxY),
    }));
  }

  function handleSave() {
    const img = imgRef.current;
    if (!img || !naturalSize) return;

    const srcSize = CROP_CONTAINER_SIZE / totalScale;
    const srcX =
      (displayedWidth / 2 - CROP_CONTAINER_SIZE / 2 - offset.x) / totalScale;
    const srcY =
      (displayedHeight / 2 - CROP_CONTAINER_SIZE / 2 - offset.y) / totalScale;

    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      srcX,
      srcY,
      srcSize,
      srcSize,
      0,
      0,
      CROP_OUTPUT_SIZE,
      CROP_OUTPUT_SIZE,
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "avatar.png", { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div
        className="relative mx-auto touch-none overflow-hidden rounded-full ring-1 ring-border"
        style={{ width: CROP_CONTAINER_SIZE, height: CROP_CONTAINER_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn to canvas below, next/image can't back a canvas source cleanly */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNaturalSize({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className="absolute top-1/2 left-1/2 max-w-none cursor-move select-none"
          style={{
            width: displayedWidth,
            height: displayedHeight,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          className="flex-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">Drag to reposition, then save the crop.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Save crop
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AvatarUploader({ initialUrl }: { initialUrl: string }) {
  const [result, formAction, pending] = useActionState(uploadAvatar, null);
  const [avatarUrl, setAvatarUrl] = useState(initialUrl);
  const [pickerImageSrc, setPickerImageSrc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const isSuccess = result != null && result.startsWith("http");
  if (isSuccess && result !== avatarUrl) {
    setAvatarUrl(result);
    if (previewUrl) setPreviewUrl(null);
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPickerImageSrc(URL.createObjectURL(file));
    e.target.value = "";
  }

  function handleCropSave(file: File) {
    const dt = new DataTransfer();
    dt.items.add(file);
    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.files = dt.files;
    }
    setPreviewUrl(URL.createObjectURL(file));
    if (pickerImageSrc) URL.revokeObjectURL(pickerImageSrc);
    setPickerImageSrc(null);
  }

  function handleCropCancel() {
    if (pickerImageSrc) URL.revokeObjectURL(pickerImageSrc);
    setPickerImageSrc(null);
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <label className="text-sm font-medium">Avatar</label>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary uploaded/pasted or cropped URL */}
        <img
          src={previewUrl ?? avatarUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
        <form
          action={formAction}
          className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input
            ref={pickerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handlePick}
            className="min-w-0 flex-1 text-sm"
          />
          <input
            ref={hiddenFileInputRef}
            type="file"
            name="avatarFile"
            className="hidden"
          />
          <button
            type="submit"
            disabled={pending || !previewUrl}
            className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-60"
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>
      {pickerImageSrc && (
        <AvatarCropper
          imageSrc={pickerImageSrc}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}
      {!pickerImageSrc && !previewUrl && (
        <p className="text-xs text-muted-foreground">
          Choose an image to crop and resize it before uploading.
        </p>
      )}
      {result && !isSuccess && (
        <p role="alert" className="text-sm text-destructive">
          {result}
        </p>
      )}
      {isSuccess && <p className="text-xs text-muted-foreground">Uploaded and saved.</p>}
      <input type="hidden" name="avatarUrl" value={avatarUrl} form="profile-form" />
    </div>
  );
}

function ResyncButton() {
  const [result, action, pending] = useActionState(resyncNow, null);

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-60"
        >
          {pending ? "Syncing..." : "Resync now"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        {result ??
          "Pulls fresh data from Codeforces/LeetCode/AtCoder right now, instead of waiting for the daily cron."}
      </p>
    </div>
  );
}

export function AdminForm({ content }: { content: ProfileContentData }) {
  const [message, formAction, pending] = useActionState(updateProfile, null);
  const [items, setItems] = useState<FeaturedItem[]>(content.featuredItems);
  const [links, setLinks] = useState<PlatformLink[]>(content.platformLinks);

  function updateItem(index: number, patch: Partial<FeaturedItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLink(index: number, patch: Partial<PlatformLink>) {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    );
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Edit profile content</h1>
        <div className="flex shrink-0 items-center gap-4">
          {message && (
            <p role="status" className="hidden text-sm text-muted-foreground sm:block">
              {message}
            </p>
          )}
          <button
            type="submit"
            form="profile-form"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {message && (
        <p role="status" className="-mt-4 text-sm text-muted-foreground sm:hidden">
          {message}
        </p>
      )}

      <ResyncButton />
      <AvatarUploader initialUrl={content.avatarUrl} />

      <form id="profile-form" action={formAction}>
        {/* Single column on mobile/tablet, two columns on desktop:
            profile fields + Achievements on the left, Platform Links
            on the right — instead of one long single-column stack
            regardless of screen width. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={content.name}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Role
                </label>
                <input
                  id="role"
                  name="role"
                  defaultValue={content.role}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <input
                id="bio"
                name="bio"
                defaultValue={content.bio ?? ""}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                defaultValue={content.email}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ctaText" className="text-sm font-medium">
                  First button text (e.g. &quot;Hire Me&quot;)
                </label>
                <input
                  id="ctaText"
                  name="ctaText"
                  defaultValue={content.ctaText}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="ctaUrl" className="text-sm font-medium">
                  First button link
                </label>
                <input
                  id="ctaUrl"
                  name="ctaUrl"
                  defaultValue={content.ctaUrl}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  Achievements ({items.length}/{MAX_FEATURED_ITEMS})
                </h2>
                <button
                  type="button"
                  disabled={items.length >= MAX_FEATURED_ITEMS}
                  onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                  className="text-sm font-medium underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                >
                  + Add
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                For platforms without live syncing (CSES, ICPC, etc.) —
                e.g. &quot;CSES 300 solved&quot; or &quot;ICPC Regionalist 2025&quot;.
              </p>

              {items.map((item, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Item {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-xs font-medium text-destructive underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    placeholder="Title (e.g. ICPC Regionalist 2025)"
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    placeholder="Description (e.g. Rating 1847)"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    className={inputClass}
                  />
                  <input
                    placeholder="Link (optional)"
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ))}

              <input
                type="hidden"
                name="featuredItems"
                value={JSON.stringify(items)}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  Platform Links ({links.length}/{MAX_PLATFORM_LINKS})
                </h2>
                <button
                  type="button"
                  disabled={links.length >= MAX_PLATFORM_LINKS}
                  onClick={() =>
                    setLinks((prev) => [...prev, { ...EMPTY_PLATFORM_LINK }])
                  }
                  className="text-sm font-medium underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                >
                  + Add
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Circular logo icons linking out to your profile on each platform
                — click the circle on the home page to open the link.
              </p>

              {links.map((link, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview of an admin-supplied arbitrary logo URL */}
                  <img
                    src={link.logoUrl || "https://placehold.co/40"}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border sm:mt-0.5"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Link {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="text-xs font-medium text-destructive underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      placeholder="Name (e.g. Codeforces)"
                      value={link.name}
                      onChange={(e) => updateLink(index, { name: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      placeholder="Logo image URL"
                      value={link.logoUrl}
                      onChange={(e) =>
                        updateLink(index, { logoUrl: e.target.value })
                      }
                      className={inputClass}
                    />
                    <input
                      placeholder="Link URL"
                      value={link.url}
                      onChange={(e) => updateLink(index, { url: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}

              <input
                type="hidden"
                name="platformLinks"
                value={JSON.stringify(links)}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
