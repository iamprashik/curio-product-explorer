import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { ProductMedia } from "../types";

export function ProductImage({
  media,
  name,
  className = "",
  priority = false,
}: {
  media: ProductMedia;
  name: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`media-frame ${className}`}>
      {failed ? (
        <div
          className="image-unavailable"
          role="img"
          aria-label={`${name}: image unavailable`}
        >
          <ImageOff size={30} />
          <span>Photo unavailable</span>
        </div>
      ) : (
        <img
          key={media.src}
          src={media.src}
          alt={`${name} — ${media.label}`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          width={720}
          height={540}
          style={{
            objectPosition: media.position ?? "center",
            transform: `scale(${media.scale ?? 1})`,
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
