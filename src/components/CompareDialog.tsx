import { useState } from "react";
import { Plus, Star, X } from "lucide-react";
import type { Product } from "../types";
import { money } from "../lib/catalogue";
import { Dialog } from "./Dialog";

export function CompareDialog({
  products,
  close,
  remove,
  add,
}: {
  products: Product[];
  close: () => void;
  remove: (id: string) => void;
  add: (p: Product) => void;
}) {
  const [differences, setDifferences] = useState(false);
  const specs = [...new Set(products.flatMap((p) => Object.keys(p.specs)))];
  const rows: [string, string[]][] = [
    ["Price", products.map((p) => money(p.price))],
    ["Brand", products.map((p) => p.brand)],
    ["Category", products.map((p) => p.category)],
    [
      "Rating",
      products.map((p) => `${p.rating.toFixed(1)} / 5 (${p.reviewCount})`),
    ],
    ["Availability", products.map((p) => (p.stock ? "In stock" : "Sold out"))],
    ...specs.map(
      (key) =>
        [key, products.map((p) => p.specs[key] ?? "—")] as [string, string[]],
    ),
  ];
  const visible = rows.filter(
    ([, values]) => !differences || new Set(values).size > 1,
  );
  return (
    <Dialog
      title="Find your perfect fit"
      close={close}
      className="comparison-dialog"
    >
      <div className="comparison-intro">
        <p>A few good options. All the important details.</p>
        <label className="check-option">
          <input
            type="checkbox"
            checked={differences}
            onChange={(e) => setDifferences(e.target.checked)}
          />
          <span>Show differences only</span>
        </label>
      </div>
      {products.length ? (
        <div className="comparison-scroll">
          <table className="comparison-table">
            <caption className="sr-only">
              Side-by-side product comparison
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <div className="compare-label">
                    <Star size={25} />
                    Made for
                    <br />a better choice.
                  </div>
                </th>
                {products.map((p) => (
                  <th key={p.id} scope="col">
                    <div className="compare-product">
                      <button
                        className="compare-remove icon-button"
                        aria-label={`Remove ${p.name} from comparison`}
                        onClick={() => remove(p.id)}
                      >
                        <X size={16} />
                      </button>
                      <img
                        src={p.image}
                        alt={p.name}
                        width="240"
                        height="180"
                      />
                      <span className="eyebrow">{p.brand}</span>
                      <strong>{p.name}</strong>
                      <button
                        className="outline-button"
                        onClick={() => add(p)}
                        disabled={!p.stock}
                      >
                        <Plus size={15} />
                        {p.stock ? "Add to bag" : "Sold out"}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(([key, values]) => (
                <tr key={key}>
                  <th scope="row">{key}</th>
                  {values.map((v, i) => (
                    <td
                      key={products[i].id}
                      className={key === "Price" ? "compare-price" : ""}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p className="comparison-empty">
              These products have the same details. Turn off “Show differences
              only” to see them.
            </p>
          )}
        </div>
      ) : (
        <div className="empty-mini">
          <p>Your comparison is empty.</p>
          <button className="primary-button" onClick={close}>
            Explore the collection
          </button>
        </div>
      )}
    </Dialog>
  );
}
