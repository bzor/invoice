export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 h-12 w-56 bg-line" />
      <div className="mb-10 h-20 border-y border-line" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 bg-hover" />
        ))}
      </div>
    </div>
  );
}
