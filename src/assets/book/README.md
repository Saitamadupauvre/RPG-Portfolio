# Book sprites

Every sprite is drawn at **1 art pixel = `--book-px` on screen** (4px on desktop, 3px on mobile,
set in `src/style/book.css`). Edit the PNGs in place; `npm run dev` reloads them. Keep the sizes
below, or update the matching numbers in `book.css`.

## 9-slice sprites

The image is cut into 9 parts. Corners keep their size; edges and the middle **repeat** to fill
any box. So: draw corner ornaments in the corners, keep edges tileable (they repeat along their
length), and keep the middle plain.

```
   slice                slice
  ┌──────┬──────────┬──────┐
  │corner│ top edge │corner│
  ├──────┼──────────┼──────┤
  │ left │  middle  │right │
  │ edge │ (repeat) │ edge │
  ├──────┼──────────┼──────┤
  │corner│ bot edge │corner│
  └──────┴──────────┴──────┘
```

| File | Size | Slice | What it is |
|---|---|---|---|
| `cover-right.png` | 24×24 | 8 | Back cover, right half of the open book. **Left edge = spine.** Only the outer ~6px show around the page. |
| `cover-left.png` | 24×24 | 8 | Same, left half: mirror of `cover-right.png`. **Right edge = spine.** |
| `cover-front.png` | 24×24 | 8 | Outside of the closed book, seen while it rises and swings open. **Left edge = hinge.** The title text is HTML, drawn on top. |
| `page-right.png` | 24×24 | 8 | Right-hand paper. **Left edge = spine shadow.** Text sits on the middle: keep it calm. Also the front of every turning page, and the only page on mobile. |
| `page-left.png` | 24×24 | 8 | Left-hand paper: mirror of `page-right.png`. Also the back of every turning page. |
| `tab.png` | 8×8 | 3 | Section tab. **Middle is transparent on purpose**: each section's colour (set in CSS) shows through, so one sprite serves every tab. Draw outline + light/shadow with semi-transparent white/black. |
| `button.png` | 8×8 | 3 | Link buttons ("Source code", "Live demo"). |

## Plain sprites

| File | Size | What it is |
|---|---|---|
| `close.png` | 9×9 | Close button, top-right corner of the book. |
| `lock.png` | 7×9 | Padlock. Full scale on a locked page, half scale in the contents list. |
| `player.png` | 32×40 | The player, on the left page of the Level section. Transparent background. |

## Still drawn in CSS

The page stacks (their thickness changes as you move through the book), the text, the
progress bar and the selection bar. Their colours are the `--book-*` variables in `book.css`.

## Rules

- Hard pixels only: no anti-aliasing, no blur, no soft brushes. Transparent PNG.
- One art pixel = one image pixel. Don't draw at 4× and shrink.
- Mirrored pairs (`cover-left`/`cover-right`, `page-left`/`page-right`) are separate files, so
  they can differ (e.g. a bookmark on one side only). Flip one to start the other.
