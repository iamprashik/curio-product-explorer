import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ArrowUpRight, Clock3, Search, X } from "lucide-react";
import { CATEGORIES, type Category, type Product } from "../types";
import { isStringList, useStoredState } from "../lib/storage";
import { money } from "../lib/catalogue";

const EMPTY: string[] = [];
type Suggestion =
  | { id: string; label: string; kind: "product"; product: Product }
  | { id: string; label: string; kind: "category"; category: Category }
  | { id: string; label: string; kind: "search" | "recent" };
function Highlight({ text, query }: { text: string; query: string }) {
  const start = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  return start < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, start + query.length)}</mark>
      {text.slice(start + query.length)}
    </>
  );
}
export function SearchBox({
  query,
  products,
  inputRef,
  live,
  change,
  submit,
  openProduct,
  category,
}: {
  query: string;
  products: Product[];
  inputRef: RefObject<HTMLInputElement | null>;
  live: boolean;
  change: (query: string) => void;
  submit: (query: string) => void;
  openProduct: (product: Product) => void;
  category: (category: Category) => void;
}) {
  const [value, setValue] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useStoredState(
    "curio.recent-searches.v2",
    EMPTY,
    isStringList,
  );
  const container = useRef<HTMLFormElement>(null);
  const changeRef = useRef(change);
  changeRef.current = change;
  const listId = useId();
  useEffect(() => {
    setValue(query);
  }, [query]);
  useEffect(() => {
    if (!live || value === query) return;
    const timer = window.setTimeout(() => changeRef.current(value), 250);
    return () => window.clearTimeout(timer);
  }, [value, query, live]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, []);
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = value.trim().toLowerCase();
    if (!q)
      return recent
        .slice(0, 4)
        .map((label, i) => ({ id: `recent-${i}`, label, kind: "recent" }));
    const terms = q.split(/\s+/);
    const matches: Suggestion[] = products
      .filter((p) =>
        terms.every((term) =>
          `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(term),
        ),
      )
      .slice(0, 5)
      .map((p) => ({ id: p.id, label: p.name, kind: "product", product: p }));
    CATEGORIES.filter(
      (c) =>
        c.toLowerCase().includes(q) && products.some((p) => p.category === c),
    )
      .slice(0, 2)
      .forEach((c) =>
        matches.push({
          id: `category-${c}`,
          label: c,
          kind: "category",
          category: c,
        }),
      );
    matches.push({ id: "search-all", label: value.trim(), kind: "search" });
    return matches;
  }, [products, value, recent]);
  const expanded = open && suggestions.length > 0;
  const remember = (term: string) => {
    const clean = term.trim();
    if (clean)
      setRecent((previous) =>
        [
          clean,
          ...previous.filter((x) => x.toLowerCase() !== clean.toLowerCase()),
        ].slice(0, 5),
      );
  };
  const commit = (term: string) => {
    remember(term);
    setOpen(false);
    setActive(-1);
    setValue(term);
    submit(term);
  };
  const choose = (item: Suggestion) => {
    setOpen(false);
    setActive(-1);
    if (item.kind === "product") {
      remember(item.label);
      setValue("");
      inputRef.current?.blur();
      openProduct(item.product);
    } else if (item.kind === "category") {
      remember(item.label);
      setValue("");
      category(item.category);
    } else commit(item.label);
  };
  return (
    <form
      ref={container}
      className="header-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (expanded && active >= 0 && suggestions[active])
          choose(suggestions[active]);
        else commit(value);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <Search size={17} />
      <label className="sr-only" htmlFor="product-search">
        Search products
      </label>
      <input
        ref={inputRef}
        id="product-search"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        placeholder="Search your next good find…"
        maxLength={200}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (index + 1) % Math.max(suggestions.length, 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              index <= 0 ? suggestions.length - 1 : index - 1,
            );
          }
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            change("");
            setActive(-1);
            inputRef.current?.focus();
          }}
        >
          <X size={15} />
        </button>
      ) : (
        <kbd>⌘ K</kbd>
      )}
      {expanded && (
        <div className="search-panel">
          <div className="search-panel-heading">
            <span>{value.trim() ? "A FEW GOOD FINDS" : "RECENT SEARCHES"}</span>
            {!value.trim() && (
              <button type="button" onClick={() => setRecent([])}>
                Clear history
              </button>
            )}
          </div>
          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {suggestions.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                {item.kind === "product" ? (
                  <img src={item.product.image} alt="" width={38} height={38} />
                ) : item.kind === "recent" ? (
                  <Clock3 size={17} />
                ) : (
                  <Search size={17} />
                )}
                <span>
                  <strong>
                    {item.kind === "search" ? (
                      <>Search for “{item.label}”</>
                    ) : (
                      <Highlight text={item.label} query={value.trim()} />
                    )}
                  </strong>
                  <small>
                    {item.kind === "product"
                      ? `${item.product.brand} · ${money(item.product.price)}`
                      : item.kind === "category"
                        ? "Explore this category"
                        : item.kind === "recent"
                          ? "Search again"
                          : "All matching products"}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </li>
            ))}
          </ul>
          <p>↑ ↓ to browse · Enter to select · Esc to close</p>
        </div>
      )}
    </form>
  );
}
