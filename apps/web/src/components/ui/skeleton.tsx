export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="pcard pcard-skeleton" aria-hidden="true">
      <Skeleton className="pcard-media" />
      <div className="pcard-body">
        <Skeleton style={{ width: '45%', height: 12 }} />
        <Skeleton style={{ width: '90%', height: 16 }} />
        <Skeleton style={{ width: '35%', height: 20, marginTop: 8 }} />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div className="product-grid" role="status" aria-label="Cargando productos">
      {Array.from({ length: cantidad }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="scard" aria-hidden="true">
      <Skeleton className="scard-cover" />
      <div className="scard-body">
        <Skeleton className="store-avatar scard-avatar" />
        <Skeleton style={{ width: '60%', height: 18 }} />
        <Skeleton style={{ width: '40%', height: 12 }} />
        <Skeleton style={{ width: '100%', height: 12 }} />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="stack" role="status" aria-label="Cargando">
      <Skeleton style={{ width: '40%', height: 32 }} />
      <Skeleton style={{ width: '100%', height: 140, borderRadius: 16 }} />
      <Skeleton style={{ width: '100%', height: 140, borderRadius: 16 }} />
    </div>
  );
}
