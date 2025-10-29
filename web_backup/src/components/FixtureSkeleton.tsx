export default function FixtureSkeleton() {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-white/10" />
          <div className="h-5 w-20 rounded-full bg-white/10" />
        </div>
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto]">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-white/10" />
            <div className="h-4 w-28 rounded bg-white/10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-14 rounded-full bg-white/10" />
            <div className="h-4 w-2 rounded bg-white/10" />
            <div className="h-10 w-14 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className="h-7 w-7 rounded bg-white/10" />
            <div className="h-4 w-28 rounded bg-white/10" />
          </div>
          <div className="md:col-span-4">
            <div className="mt-3 h-9 w-32 rounded-full bg-white/10 md:mt-4" />
          </div>
        </div>
      </div>
    );
  }
  