import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Box,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Text,
  VisuallyHidden,
} from "@radix-ui/themes";
import Nav from "../components/Nav";

const GAP = 12;
const ROW_UNIT = 4;
const MIN_COL = 280;
const MIN_COL_SMALL = 150;

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
};

async function loadJson(url, fallback) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export default function Art() {
  const [items, setItems] = useState(null);
  const [openIndex, setOpenIndex] = useState(null);

  const gridRef = useRef(null);
  const itemRefs = useRef(new Map());
  const openerRef = useRef(null);
  const [cols, setCols] = useState(1);
  const [spans, setSpans] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadJson("/gallery/manifest.json", []),
      loadJson("/gallery/captions.json", {}),
    ]).then(([manifest, captions]) => {
      if (cancelled) return;
      const list = (Array.isArray(manifest) ? manifest : []).map((entry) => ({
        ...entry,
        description:
          captions[entry.file] || captions[entry.id] || entry.description || "",
      }));
      setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const recompute = () => {
      const width = el.clientWidth;
      if (!width) return;
      const min = window.innerWidth <= 540 ? MIN_COL_SMALL : MIN_COL;
      setCols(Math.max(1, Math.floor((width + GAP) / (min + GAP))));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  useLayoutEffect(() => {
    if (!items || items.length === 0) return;

    const ro = new ResizeObserver((entries) => {
      setSpans((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const entry of entries) {
          const file = entry.target.dataset.file;
          const height =
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          const span = Math.max(1, Math.ceil((height + GAP) / ROW_UNIT));
          if (next[file] !== span) {
            next[file] = span;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    for (const node of itemRefs.current.values()) {
      if (node) ro.observe(node);
    }
    return () => ro.disconnect();
  }, [items, cols]);

  const setItemRef = useCallback((file) => (node) => {
    if (node) itemRefs.current.set(file, node);
    else itemRefs.current.delete(file);
  }, []);

  const count = items?.length ?? 0;
  const goPrev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + count) % count)),
    [count],
  );
  const goNext = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % count)),
    [count],
  );

  const active = openIndex === null ? null : items[openIndex];

  return (
    <Box px="4" py="6" style={{ maxWidth: 1600, margin: "0 auto" }}>
      <Nav current="art" />

      <Heading as="h1" size="4" weight="regular" mb="5">
        art
      </Heading>
      <Text
        as="p"
        size="3"
        align="center"
        color="gray"
        highContrast
        mb="6"
        style={{ maxWidth: "68ch", marginInline: "auto" }}
      >
       I paint and draw. Lately, I've been playing around with alternative process photography as well. This page is a repository of random unfinished projects.
      </Text>


      {items === null && (
        <Text as="p" size="2" color="gray">
          loading…
        </Text>
      )}

      {items !== null && items.length === 0 && (
        <Text as="p" size="2" color="gray">
          nothing here yet — drop a photo in the google drive folder and it'll
          show up within the hour.
        </Text>
      )}

      <div
        ref={gridRef}
        className="masonry"
        style={{
          "--gap": `${GAP}px`,
          "--row-unit": `${ROW_UNIT}px`,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {(items ?? []).map((item, i) => (
          <button
            key={item.file}
            type="button"
            className="masonry-item"
            style={{ gridRowEnd: `span ${spans[item.file] ?? 40}` }}
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              setOpenIndex(i);
            }}
          >
            <div ref={setItemRef(item.file)} data-file={item.file}>
              <figure>
                <img
                  src={`/gallery/thumb/${item.file}`}
                  alt={item.description ? "" : "untitled"}
                  loading="lazy"
                  decoding="async"
                  width={item.w}
                  height={item.h}
                  style={{ aspectRatio: `${item.w} / ${item.h}` }}
                />
                {item.description && (
                  <figcaption>
                    <Text as="span" size="1" color="gray">
                      {item.description}
                    </Text>
                  </figcaption>
                )}
              </figure>
            </div>
          </button>
        ))}
      </div>

      <Dialog.Root
        open={openIndex !== null}
        onOpenChange={(open) => {
          if (open) return;
          setOpenIndex(null);
          setTimeout(() => openerRef.current?.focus(), 0);
        }}
      >
        <Dialog.Content
          maxWidth="1100px"
          style={{ position: "relative" }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
          }}
        >
          <Dialog.Close>
            <IconButton
              className="lightbox-close"
              variant="soft"
              color="gray"
              aria-label="Close"
            >
              ×
            </IconButton>
          </Dialog.Close>

          <VisuallyHidden>
            <Dialog.Title>
              {active?.description || "artwork"}
              {active?.date ? ` — ${formatDate(active.date)}` : ""}
            </Dialog.Title>
          </VisuallyHidden>

          {active && (
            <Flex direction="column" gap="3">
              <img
                className="lightbox-image"
                src={`/gallery/full/${active.file}`}
                alt={active.description || "untitled"}
                width={active.w}
                height={active.h}
              />

              <Flex align="center" justify="between" gap="3">
                <IconButton
                  variant="ghost"
                  color="gray"
                  onClick={goPrev}
                  disabled={count < 2}
                  aria-label="Previous"
                >
                  ‹
                </IconButton>

                <Flex direction="column" align="center" gap="1" style={{ flex: 1 }}>
                  {active.date && (
                    <Text size="1" color="gray">
                      {formatDate(active.date)}
                    </Text>
                  )}
                  {active.description && (
                    <Dialog.Description
                      size="2"
                      align="center"
                      color="gray"
                      highContrast
                    >
                      {active.description}
                    </Dialog.Description>
                  )}
                </Flex>

                <IconButton
                  variant="ghost"
                  color="gray"
                  onClick={goNext}
                  disabled={count < 2}
                  aria-label="Next"
                >
                  ›
                </IconButton>
              </Flex>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
