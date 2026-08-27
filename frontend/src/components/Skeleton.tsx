/** 스켈레톤 로딩 UI — 레이아웃/카드 구조를 유지한 채 로딩 상태 표시 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200/70 rounded-md ${className}`} aria-hidden="true" />
}

export function SkeletonText({ w = 'w-full', className = '' }: { w?: string; className?: string }) {
  return <Skeleton className={`h-3 ${w} ${className}`} />
}

export function SkeletonCircle({ size = 'w-8 h-8' }: { size?: string }) {
  return <Skeleton className={`${size} rounded-full`} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <SkeletonText w="w-20" />
        <SkeletonCircle />
      </div>
      <SkeletonText w="w-24" className="h-6 mt-3" />
      <SkeletonText w="w-32" className="mt-2" />
    </div>
  )
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SkeletonCircle size="w-8 h-8" />
      <div className="flex-1 space-y-2">
        <SkeletonText w="w-3/4" />
        <SkeletonText w="w-1/2" />
      </div>
    </div>
  )
}