import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Container,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Text,
  VisuallyHidden,
} from "@radix-ui/themes";
import Nav from "../components/Nav";

const GAP = 12; // px between tiles, both axes
const ROW_UNIT = 4; // px height of one implicit grid row
const MIN_COL = 240; // px target minimum column width
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
  const [items, setItems] = useState(null); // null = still loading
  const [openIndex, setOpenIndex] = useState(null);

  const gridRef = useRef(null);
  const itemRefs = useRef(new Map());
  // the tile that opened the lightbox, so focus can go back to it on close
  const openerRef = useRef(null);
  const [cols, setCols] = useState(1);
  const [spans, setSpans] = useState({});

  // captions.json is hand-edited and optional; manifest.json doesn't exist
  // until the first Drive sync runs. Both missing is a normal empty state,
  // not an error.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadJson("/gallery/manifest.json", []),
      loadJson("/gallery/captions.json", {}),
    ]).then(([manifest, captions]) => {
      if (cancelled) return;
      const list = (Array.isArray(manifest) ? manifest : []).map((entry) => ({
        ...entry,
        // a hand-written caption always wins over the generated one
        description: captions[entry.file] ?? entry.description ?? "",
      }));
      setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Column count is computed rather than left to auto-fill because the row
  // spans below need to know the actual column width.
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

  // Each tile spans however many thin rows its real rendered height needs —
  // measured, so a long caption is accounted for as well as the image.
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
    <Container size="4" px="4" py="6">
      <Nav current="art" />

      <Heading as="h1" size="4" weight="regular" mb="5">
        art
      </Heading>
      <Text as="p" size="3" align="center" color="gray" highContrast>
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
                  // when a visible caption follows, alt would make a screen
                  // reader announce the same text twice
                  alt={item.description ? "" : "untitled"}
                  loading="lazy"
                  decoding="async"
                  width={item.w}
                  height={item.h}
                  // reserve the right box before the image loads, so the
                  // measured span is correct on first paint
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
          // Radix aims its own focus restore at a Dialog.Trigger, and there
          // isn't one here (the dialog is driven by index), so focus would be
          // left on <body> and a keyboard user dumped back to the top of the
          // page. Deferred so it lands after the dialog has released focus.
          setTimeout(() => openerRef.current?.focus(), 0);
        }}
      >
        <Dialog.Content
          maxWidth="1100px"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
          }}
        >
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
                    // no asChild: Themes' Dialog.Description forces asChild
                    // false after spreading props, so a nested <Text> would be
                    // dropped. Its own props reach the Text it renders.
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
    </Container>
  );
}
